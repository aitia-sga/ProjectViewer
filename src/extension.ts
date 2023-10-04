
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

		vscode.commands.registerCommand('projectViewer.deleteFolderWithFiles', (directory: projects.LogicalDirectory) => {
			myProjects.removeObjectFromProject(directory);
			activeProjectsProvider.refresh();
		}),

		vscode.commands.registerCommand('projectViewer.rename', async (item: projects.Item) => {
			const options: vscode.InputBoxOptions = {
				prompt: "Enter the new name",
				value: item.name
			};

			let newName = await vscode.window.showInputBox(options);

			if(newName && newName !== item.name) {
				if(!myProjects.renameAvailable(item, newName)) {
					vscode.window.showInformationMessage(`${newName} project is already exists!`);
					return;
				}

				myProjects.renamedItem(item, newName);
				
				if(item.type === 'project') {
					if(activeProjectsData.activeProjects.includes(item.name)) {
						const projectIndex = activeProjectsData.activeProjects.indexOf(item.name);
						if(projectIndex !== -1)
						{
							activeProjectsData.activeProjects.splice(projectIndex, 1);
							fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4));
						}
					}

					if(!activeProjectsData.activeProjects.includes(newName)) {
						activeProjectsData.activeProjects.push(newName);
						fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4));
					}
					
					projectsProvider.refresh();
				}

				activeProjectsProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('projectViewer.addToProject', async (fileUri: vscode.Uri) => {			
			if (!fileUri)  { vscode.window.showErrorMessage('fileUri is empty!'); return; }

			let fileType = "file";

			fs.stat(fileUri.fsPath, (err: any, stats: any) => {
				if(err) { vscode.window.showErrorMessage(`Cannot retrieve file information: ${err.message}`); }
				else if(stats.isDirectory())
					fileType = "physicalDirectory";
			})

			showItemPicker(myProjects.getProjects()).then(selectedItem => {
				if (selectedItem) {
					myProjects.addFileToProject(selectedItem, fileUri, fileType)
					activeProjectsProvider.refresh();
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
			? items.map(item => ({ label: item.name, item })).filter(item => item.item.type === 'logicalDirectory' || item.item.type === 'project')
			: [
				{ label: `Select current directory`, item: { name: 'Current', type: 'current', items: [] } },
				...items.map(item => ({ label: item.name, item })).filter(item => item.item.type === 'logicalDirectory' || item.item.type === 'project')
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
	// private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	// readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;
	// private watchers: fs.FSWatcher[] = [];

	// constructor(private projectsData: any, private activeProjectsNames: string[]) {}

	// refresh(): void {
	// 	this._onDidChangeTreeData.fire(undefined);
	// }

	private _onDidChangeTreeData: vscode.EventEmitter<any | undefined> = new vscode.EventEmitter<any | undefined>();
	readonly onDidChangeTreeData: vscode.Event<any | undefined> = this._onDidChangeTreeData.event;

	private watchers: fs.FSWatcher[] = [];

	constructor(private projectsData: any, private activeProjectsNames: string[]) {}

	refresh(element?: any): void {
		this._onDidChangeTreeData.fire(element);
	}

	dispose() {
		this.watchers.forEach(w => w.close());
		this.watchers = [];
	}



	getTreeItem(element: any): vscode.TreeItem {
		if (element.type == 'project' || element.type == 'logicalDirectory') {
			let treeItem = new vscode.TreeItem(element.name);
			treeItem.label = element.name;
			treeItem.contextValue = element.type;
			treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
			if (element.type === 'logicalDirectory') {
				treeItem.iconPath = new vscode.ThemeIcon('folder-active');
				treeItem.tooltip = `${element.name} (Logical Directory)`;
				treeItem.description = '(Logical Directory)';
			}
			else
				treeItem.iconPath = new vscode.ThemeIcon('project');
				// treeItem.iconPath = new vscode.ThemeIcon('organization');

			return treeItem;
		} else if (element.type === 'physicalDirectory') {
			return {
				label: element.name,
				tooltip: element.absolutPath,
				contextValue: 'physicalDirectory',
				iconPath: new vscode.ThemeIcon('folder'),
            	collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
			};
		} else /*if(element == 'file')*/ {
			return {
				label: element.name,
				collapsibleState: vscode.TreeItemCollapsibleState.None,
				contextValue: 'file',
				iconPath: new vscode.ThemeIcon('file'),
				tooltip: element.absolutPath,
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
		} else if (element.type === 'physicalDirectory') {
			return new Promise(resolve => {
				fs.readdir(element.absolutPath, (err, files) => {
					if (err) {
						vscode.window.showErrorMessage(`Error reading directory: ${err.message}`);
						resolve([]);
					} else {
						const items = files.map(file => ({
							name: file,
							type: fs.statSync(path.join(element.absolutPath, file)).isDirectory() ? 
								'physicalDirectory' : 'file',
							absolutPath: path.join(element.absolutPath, file)
						}));

						// Setting up fs.watch to watch the physical directory for changes.
						const watcher = fs.watch(element.absolutPath, (_eventType: any, _filename: any) => {
							if(_filename)
								this.refresh(element);
						});

						// Storing the watcher so that it can be closed later if needed.
						this.watchers.push(watcher);

						resolve(items);
					}
				});
			});
		} else {
			return Promise.resolve([]);
		}
	}
}
