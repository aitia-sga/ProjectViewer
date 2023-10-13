
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as projects from './projects';


interface MyQuickPickItem extends vscode.QuickPickItem { item: projects.Item; }


export function activate(context: vscode.ExtensionContext) {
	let vsCodeFolder = "";

	try {
		if(vscode.workspace.workspaceFolders![0].uri.fsPath) {
			vsCodeFolder = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, '.vscode');

			if(!fs.existsSync(vsCodeFolder)) {
				try { fs.mkdirSync(vsCodeFolder); }
				catch {vscode.window.showErrorMessage(".vscode floder create error!"); }
			}

		} else { vscode.window.showErrorMessage('No workspace is open! Please open a workspace or folder!'); }
		
	} catch { vscode.window.showErrorMessage('No workspace is open! Please open a workspace or folder!'); }

	const myProjects = new projects.MyProjects(path.join(vsCodeFolder, 'projects.json'));
	const activeProjectsPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, '.vscode', 'activeProjects.json');

	let activeProjectsData: { activeProjects: string[] };
	try {
		const filteredString = fs.readFileSync(activeProjectsPath, 'utf8').split('\n').filter(line => !line.trim().startsWith('//'));
		activeProjectsData = JSON.parse(filteredString.join('\n'));
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
				try { fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4)); } catch {}
				activeProjectsProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('projectViewer.removeProjectFromActive', (project) => {
			if (activeProjectsData.activeProjects.includes(project.name)) {
				const projectIndex = activeProjectsData.activeProjects.indexOf(project.name);
				if(projectIndex !== -1)
				{
					activeProjectsData.activeProjects.splice(projectIndex, 1);
					try { fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4)); } catch {}
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
				const description = await descriptionRequest();
				myProjects.createNewProject(userInput, description);
				projectsProvider.refresh();
			} else
				vscode.window.showInformationMessage('No input provided');	
		}),
		
		vscode.commands.registerCommand('projectViewer.deleteProject', async (deletedProject) => {
			const result = await vscode.window.showInformationMessage(
				'Are you sure you want to delete this project?',
				{ modal: true },
				'Yes'
				);
				
				if (result === 'Yes') {
					myProjects.deleteProject(deletedProject);
					projectsProvider.refresh();
					
					const projectIndex = activeProjectsData.activeProjects.indexOf(deletedProject.name);
					if(projectIndex !== -1)
					{
						activeProjectsData.activeProjects.splice(projectIndex, 1);
						try { fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4)); } catch {}
						activeProjectsProvider.refresh();
					}
				}
			}),
			
			vscode.commands.registerCommand('projectViewer.importProject', async (exportedProject) => {
				const uris = await vscode.window.showOpenDialog({
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					openLabel: 'Select Imported file',
					
					filters: {
						'JSON': ['json']
					},
				});
				
				if (uris && uris[0]) {
					
					const importedProjects = new projects.MyProjects(uris[0].fsPath);
					myProjects.importProjects(importedProjects.getProjects());
					projectsProvider.refresh();
					vscode.window.showInformationMessage('Project import successfully!');

				} else {
					vscode.window.showInformationMessage('Project import cancelled.');
				}
			}),
			
			vscode.commands.registerCommand('projectViewer.exportProject', async (exportedProject) => {
				const uri = await vscode.window.showSaveDialog({
					defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, exportedProject.name + '.json')),
					filters: {
						'JSON': ['json'],
						'All Files': ['*']
					},
					saveLabel: 'Export'
				});
			
				if (uri) {
					try { fs.writeFileSync(uri.fsPath, JSON.stringify(myProjects.getProjects().filter(project => project == exportedProject), null, 4)); } catch {}
					vscode.window.showInformationMessage('Project exported successfully!');
				} else
					vscode.window.showInformationMessage('Project export cancelled.');				
			}),
			
		vscode.commands.registerCommand('projectViewer.createNewFolder', async (project) => {
			if(!myProjects.containsProject) {vscode.window.showErrorMessage('The selected project cannot be found!'); return; }
			
			const userInput = await vscode.window.showInputBox({
				prompt: 'Enter the name of the folder!',
				placeHolder: 'Folder name'
			});

			if (userInput) {
				myProjects.createNewFolder(project, userInput, (await descriptionRequest()));
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
							try { fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4)); } catch {}
						}
					}

					if(!activeProjectsData.activeProjects.includes(newName)) {
						activeProjectsData.activeProjects.push(newName);
						try { fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4)); } catch {}
					}
					
					projectsProvider.refresh();
				}

				activeProjectsProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('projectViewer.modifyDescription', async (item: projects.Item) => {
			const options: vscode.InputBoxOptions = {
				prompt: "Enter the new description",
				placeHolder: 'Description',
				value: item.description
			};

			let newDescription = await vscode.window.showInputBox(options);
			if(!newDescription) newDescription = '';

			if(newDescription !== item.description) {
				myProjects.modifyDescription(item, newDescription);
				
				if(item.type === 'project')
					projectsProvider.refresh();
				
				activeProjectsProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('projectViewer.addToProject', async (...commandArgs) => {			
			if (!commandArgs || !commandArgs[1])  { vscode.window.showErrorMessage('fileUri is empty!'); return; }

			const fileUris = commandArgs[1];

			try {
				const selectedItem = await showItemPicker(myProjects.getProjects());
				if (selectedItem) {
					const description = await descriptionRequest();
					
					for (const fileUri of fileUris) {
						let fileType = "file";
			
						const stats = fs.statSync(fileUri.fsPath);
						if(stats.isDirectory()) 
							fileType = "physicalDirectory";
						
						myProjects.addFileToProject(selectedItem, fileUri, fileType, description);
						activeProjectsProvider.refresh();
					}

				}
			} catch (err: any) {
				vscode.window.showErrorMessage(`An error occurred: ${err.message}`);
			}
		}),



		vscode.commands.registerCommand('projectViewer.removeFromProject', async (removedFile: projects.File) => {
			myProjects.removeObjectFromProject(removedFile);
			activeProjectsProvider.refresh();
		})
			  
	);
}

async function descriptionRequest(): Promise<string> {
	const userInput = await vscode.window.showInputBox({
		prompt: 'Enter the description, or press Enter!',
		placeHolder: 'Description'
	});
	
	if (userInput)
		return userInput;
	else
		return '';
}

function showItemPicker(items: projects.Item[], isRoot = true): Promise<projects.Item | undefined> {
	return new Promise((resolve, reject) => {
		const quickPick = vscode.window.createQuickPick<MyQuickPickItem>();
		
		quickPick.items = isRoot 
			? items.map(item => ({ label: item.name, item })).filter(item => item.item.type === 'logicalDirectory' || item.item.type === 'project')
			: [
				{ label: `Select current directory`, item: { name: 'Current', type: 'current', description: '', items: [] } },
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
	private _onDidChangeTreeData: vscode.EventEmitter<any | undefined> = new vscode.EventEmitter<any | undefined>();
	readonly onDidChangeTreeData: vscode.Event<any | undefined> = this._onDidChangeTreeData.event;

	constructor(private projects: projects.Project[]) {}

	refresh(element?: any): void {
		this._onDidChangeTreeData.fire(element);
	}

	getTreeItem(element: any): vscode.TreeItem {
		return {
			label: element.name,
			contextValue: 'project',
			iconPath: new vscode.ThemeIcon(element.icon ? element.icon : 'project'),
			description: element.description ? element.description : '',
			collapsibleState: vscode.TreeItemCollapsibleState.None,
		};
	}

	getChildren(element?: any): Thenable<any[]> {
		if (!element) {
			return Promise.resolve(this.projects.sort((a, b) => a.name.localeCompare(b.name)));
		}
		return Promise.resolve([]);
	}
}

class ActiveProjectsTreeProvider implements vscode.TreeDataProvider<any> {
	private _onDidChangeTreeData: vscode.EventEmitter<any | undefined> = new vscode.EventEmitter<any | undefined>();
	readonly onDidChangeTreeData: vscode.Event<any | undefined> = this._onDidChangeTreeData.event;

	private watchers: fs.FSWatcher[] = [];

	constructor(private projectsData: projects.Project[], private activeProjectsNames: string[]) {}

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
				treeItem.tooltip = `${element.name} (Logical Directory)`;
				treeItem.description = element.description ? element.description : '(Logical Directory)';
			}
			else {
				treeItem.description = element.description ? element.description : '';
				treeItem.iconPath = new vscode.ThemeIcon(element.icon ? element.icon : 'project');
			}

			return treeItem;
		} else if (element.type === 'physicalDirectory') {
			return {
				label: element.name,
				tooltip: element.absolutPath,
				contextValue: 'physicalDirectory',
				iconPath: new vscode.ThemeIcon(element.icon ? element.icon : 'folder'),
				description: element.description ? element.description : '',
            	collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
			};
		} else {
			// File
			let treeItemFile = new vscode.TreeItem(element.name);
			treeItemFile.label = element.name;
			treeItemFile.collapsibleState = vscode.TreeItemCollapsibleState.None;
			treeItemFile.contextValue = 'file';

			if(element.icon) {
				treeItemFile.iconPath = new vscode.ThemeIcon(element.icon);
			} else {
				treeItemFile.iconPath = vscode.ThemeIcon.File;
				treeItemFile.resourceUri = vscode.Uri.parse(element.absolutPath);
			}
			treeItemFile.tooltip = element.absolutPath;
			treeItemFile.description = element.description ? element.description : '';
			treeItemFile.command = {
				command: 'vscode.open',
				arguments: [vscode.Uri.file(element.absolutPath)],
				title: 'Open File'
			}

			return treeItemFile;
		}
	}

	getChildren(element?: any): Thenable<any[]> {
		if (!element) {
			return Promise.resolve(this.projectsData.filter((project: any) => this.activeProjectsNames.includes(project.name))
			.sort((a, b) => this.elementCompare(a, b)));

		} else if (element.type === 'project' || element.type === 'logicalDirectory') {
			return Promise.resolve(element.items.sort((a: projects.Item, b: projects.Item) => this.elementCompare(a, b)));
			
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

						const watcher = fs.watch(element.absolutPath, (_eventType: any, _filename: any) => {
							if(_filename)
								this.refresh(element);
						});

						this.watchers.push(watcher);

						resolve(items.sort((a, b) => this.elementCompare(a, b)));
					}
				});
			});
		} else {
			return Promise.resolve([]);
		}
	}

	elementCompare(a: projects.Item | any, b: projects.Item | any): number {
		if(a.type === b.type) return a.name.localeCompare(b.name);

		if(a.type === 'logicalDirectory' && b.type === 'physicalDirectory') return -1;
		if(b.type === 'logicalDirectory' && a.type === 'physicalDirectory') return 1;
		
		if(a.type === 'logicalDirectory' && b.type === 'file') return -1;
		if(b.type === 'logicalDirectory' && a.type === 'file') return 1;

		if(a.type === 'physicalDirectory' && b.type === 'file') return -1;
		if(b.type === 'physicalDirectory' && a.type === 'file') return 1;

		return 0;
	}
}
