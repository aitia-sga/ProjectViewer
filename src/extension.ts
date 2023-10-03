
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as projects from './projects';
import { ExecException } from 'child_process';

interface MyQuickPickItem extends vscode.QuickPickItem { item: projects.Item; }


export function activate(context: vscode.ExtensionContext) {
	const myProjects = new projects.MyProjects(path.join(context.extensionPath, 'projects.json'));
	const activeProjectsPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, '.vscode', 'activeProjects.json');

	let activeProjectsData: { activeProjects: string[] };
	try {
		activeProjectsData = JSON.parse(fs.readFileSync(activeProjectsPath, 'utf8'));
	} catch {
		activeProjectsData = { activeProjects: [] };
	}

	const projectsProvider = new ProjectsTreeProvider(myProjects.getProjects());
	vscode.window.registerTreeDataProvider('projectsView', projectsProvider);

	const activeProjectsProvider = new ActiveProjectsTreeProvider(myProjects.getProjects(), activeProjectsData.activeProjects);
	vscode.window.registerTreeDataProvider('activeProjectsView', activeProjectsProvider);

	context.subscriptions.push(
		vscode.commands.registerCommand('projectViewer.addProjectToActive', (project) => {
			if (!activeProjectsData.activeProjects.includes(project.name)) {
				activeProjectsData.activeProjects.push(project.name);
				fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4));
				activeProjectsProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('projectViewer.removeProjectFromActive', (project) => {
			if (activeProjectsData.activeProjects.includes(project.name)) {
				const projectIndex = activeProjectsData.activeProjects.indexOf(project.name);
				if(projectIndex !== -1)
				{
					activeProjectsData.activeProjects.splice(projectIndex, 1);
					fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4));
					activeProjectsProvider.refresh();
				}
			}
		}),

		vscode.commands.registerCommand('projectViewer.createNewFolder', async (project) => {
			if(!myProjects.containsProject) {vscode.window.showErrorMessage('The selected project cannot be found!'); return; }
			
			const userInput = await vscode.window.showInputBox({
				prompt: 'Enter the name of the folder!',
				placeHolder: 'Folder name'
			});

			if (userInput) {
				myProjects.createNewFolder(project, userInput);
				activeProjectsProvider.refresh()
			} else
				vscode.window.showInformationMessage('No input provided');	
		}),

		vscode.commands.registerCommand('projectViewer.newProject', async () => {
			const userInput = await vscode.window.showInputBox({
				prompt: 'Enter the name of the project',
				placeHolder: 'Project name'
			});
			
			if (userInput) {
				myProjects.createNewProject(userInput);
				projectsProvider.refresh();
			} else
				vscode.window.showInformationMessage('No input provided');	
		}),

		vscode.commands.registerCommand('projectViewer.deleteFolderWithFiles', (directory: projects.LogicalDirectory) => {
			myProjects.removeObjectFromProject(directory);
			activeProjectsProvider.refresh();
		}),

		vscode.commands.registerCommand('projectViewer.addToProject', async (fileUri: vscode.Uri) => {			
			if (!fileUri)  { vscode.window.showErrorMessage('fileUri is empty!'); return; }

			showItemPicker(myProjects.getProjects()).then(selectedItem => {
				if (selectedItem) {
					vscode.window.showInformationMessage(`Selected: ${selectedItem.name}`);
					const newFile: projects.File = {
						name: path.basename(fileUri.fsPath),
						type: "file",
						items: [],
						absolutPath: fileUri.fsPath
					};

					selectedItem.items.push(newFile); activeProjectsProvider.refresh();
				}
			});
		}),

		vscode.commands.registerCommand('projectViewer.removeFromProject', async (removedFile: projects.File) => {
			myProjects.removeObjectFromProject(removedFile);
			activeProjectsProvider.refresh();
		})
	);
}

function showItemPicker(items: projects.Item[], isRoot = true): Promise<projects.Item | undefined> {
	return new Promise((resolve, reject) => {
		const quickPick = vscode.window.createQuickPick<MyQuickPickItem>();
		
		quickPick.items = isRoot 
			? items.map(item => ({ label: item.name, item })).filter(item => item.item.type === 'logicalDirectory' || 'project')
			: [
				{ label: `Select current directory`, item: { name: 'Current', type: 'current', items: [] } },
				...items.map(item => ({ label: item.name, item }))
			  ];

		quickPick.onDidAccept(() => {
			const selectedItem = quickPick.selectedItems[0].item;
			quickPick.hide();

			if (selectedItem.type === 'current') {
				resolve(undefined);
			} else if (selectedItem.items.length > 0) {
				showItemPicker(selectedItem.items, false).then(nextSelectedItem => {
					if (nextSelectedItem) {
						resolve(nextSelectedItem);
					} else {
						resolve(selectedItem);
					}
				});
			} else {
				resolve(selectedItem);
			}
		});

		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	});
}


class ProjectsTreeProvider implements vscode.TreeDataProvider<any> {
	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

	constructor(private projects: any[]) {}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: any): vscode.TreeItem {
		return {
			label: element.name,
			contextValue: 'project',
			collapsibleState: vscode.TreeItemCollapsibleState.None,
		};
	}

	getChildren(element?: any): Thenable<any[]> {
		if (!element) {
			return Promise.resolve(this.projects);
		}
		return Promise.resolve([]);
	}
}

class ActiveProjectsTreeProvider implements vscode.TreeDataProvider<any> {
	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

	constructor(private projectsData: any, private activeProjectsNames: string[]) {}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: any): vscode.TreeItem {
		if (element.type == 'project' || element.type == 'logicalDirectory') {
			return {
				label: element.name,
				contextValue: element.type,
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
			};
		/* } else if ('name' in element && !('directorys' in element)) {
			return {
				label: element.name,
				collapsibleState: vscode.TreeItemCollapsibleState.None
			}; */
		} else /*if(element == 'file')*/ {
			return {
				label: element.name,
				collapsibleState: vscode.TreeItemCollapsibleState.None,
				contextValue: 'file',
				command: {
					command: 'vscode.open',
					arguments: [vscode.Uri.file(element.absolutPath)],
					title: 'Open File'
				}
			};
		}
	}

	getChildren(element?: any): Thenable<any[]> {
		if (!element) {
			return Promise.resolve(this.projectsData.filter((project: any) => this.activeProjectsNames.includes(project.name)));
		} else if (element.type === 'project' || element.type === 'logicalDirectory') {
			return Promise.resolve(element.items);
		} else {
			return Promise.resolve([]);
		}
	}
}
