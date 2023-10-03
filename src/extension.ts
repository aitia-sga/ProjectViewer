
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as projects from './projects';
import { ExecException } from 'child_process';

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

			// let selectedProject;

			// if (!fileUri)  { vscode.window.showErrorMessage('fileUri is empty!'); return; }
			
			// const projectNames = myProjects.getProjects().map(project => project.name);
			// const selectedProjectName = await vscode.window.showQuickPick(projectNames, {placeHolder: 'Please select the project!'});
			
			// if (selectedProjectName) {
			// 	selectedProject = myProjects.getProjects().find(project => project.name === selectedProjectName);
			// 	if (!selectedProject) { vscode.window.showErrorMessage('The selected project cannot be found!'); return; }
				
				
			// } else return;
			
			// const directoryNames = selectedProject.directorys.map(directory => directory.name);
			// const selectedDirectoryName = await vscode.window.showQuickPick(directoryNames, {placeHolder: 'Please select the directory!'});
			
			// if (!selectedDirectoryName) return;

			// myProjects.addFileToProject(selectedProjectName, selectedDirectoryName, fileUri.fsPath, path.basename(fileUri.fsPath));
			// activeProjectsProvider.refresh();
			// showQuickPick();
			showFolderPicker("/");
		}),

		vscode.commands.registerCommand('projectViewer.removeFromProject', async (removedFile: projects.File) => {
			myProjects.removeObjectFromProject(removedFile);
			activeProjectsProvider.refresh();
		})
	);
}

// async function showQuickPick() {
//     const workspaceFolders = vscode.workspace.workspaceFolders;
//     if (!workspaceFolders) {
//         vscode.window.showInformationMessage('Nincsenek munkaterület mappák betöltve.');
//         return;
//     }

//     const quickPick = vscode.window.createQuickPick();
//     quickPick.items = workspaceFolders.map(folder => ({ label: folder.name, folder: folder }));

//     quickPick.onDidChangeSelection(selection => {
//         if (selection.length > 0) {
//             vscode.window.showInformationMessage(`Kiválasztva: ${selection[0].label}`);
//             // Itt megnyithatod a kiválasztott mappát vagy futtathatsz egyéb műveleteket
//         }
//     });

//     quickPick.onDidHide(() => quickPick.dispose());
//     quickPick.show();
// }

interface MyQuickPickItem extends vscode.QuickPickItem {
    fullPath: string;
}
// async function showQuickPick(folderPath: string = "/"): Promise<void> {
//     const quickPick = vscode.window.createQuickPick();
//     quickPick.placeholder = "Válassz egy mappát...";

//     // Mappák és fájlok listázása az adott mappában
//     fs.readdir(folderPath, { withFileTypes: true }, (err, items) => {
//         if (err) {
//             vscode.window.showErrorMessage("Hiba az almappák betöltése közben");
//             return;
//         }

//         quickPick.items = items.filter(item => item.isDirectory())
//             .map(dir => ({ label: dir.name, fullPath: path.join(folderPath, dir.name) }));
//     });

//     // Eseménykezelő a mappa választáshoz
//     quickPick.onDidChangeSelection(selection: MyQuickPickItem => {
//         if (selection.length > 0) {
//             const selectedFolderPath = selection[0].fullPath;
//             quickPick.dispose();  // Bezárjuk az aktuális QuickPick ablakot
//             showQuickPick(selectedFolderPath);  // Megjelenítjük az új mappában
//         }
//     });

//     quickPick.onDidHide(() => quickPick.dispose());
//     quickPick.show();
// }

// function showFolderPicker(currentPath: string) {
//     const quickPick = vscode.window.createQuickPick<MyQuickPickItem>();
//     quickPick.placeholder = 'Select a folder...';

//     try {
//         const files = fs.readdirSync(currentPath);
//         quickPick.items = files.map(file => ({
//             label: file,
//             fullPath: path.join(currentPath, file)
//         }));
//     } catch (error: any) {
//         vscode.window.showErrorMessage(`Error reading directory: ${error.message}`);
//         quickPick.hide();
//         return;
//     }

//     quickPick.onDidAccept(() => {
//         const selectedPath = quickPick.selectedItems[0].fullPath;
//         try {
//             if (fs.statSync(selectedPath).isDirectory()) {
//                 quickPick.hide();  // bezárjuk az előző QuickPick-et
//                 showFolderPicker(selectedPath);  // és megnyitjuk az újat
//             } else {
//                 quickPick.hide();
//             }
//         } catch (error: any) {
//             vscode.window.showErrorMessage(`Error selecting item: ${error.message}`);
//             quickPick.hide();
//         }
//     });

//     quickPick.onDidHide(() => quickPick.dispose());
//     quickPick.show();
// }


function showFolderPicker(currentPath: string) {
    const quickPick = vscode.window.createQuickPick<MyQuickPickItem>();
    quickPick.placeholder = 'Select a folder...';

    try {
        const files = fs.readdirSync(currentPath);
        quickPick.items = [
            { label: `Select: ${currentPath}`, fullPath: currentPath },  // The special item
            ...files.map(file => ({
                label: file,
                fullPath: path.join(currentPath, file)
            })).filter(item => fs.statSync(item.fullPath).isDirectory())
        ];
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error reading directory: ${error.message}`);
        quickPick.hide();
        return;
    }

    quickPick.onDidAccept(() => {
        const selectedPath = quickPick.selectedItems[0].fullPath;
        try {
            if (fs.statSync(selectedPath).isDirectory()) {
                if (selectedPath === currentPath) {  // The special item is selected
                    vscode.window.showInformationMessage(`Selected Path: ${currentPath}`);
                    quickPick.hide();
                } else {
                    quickPick.hide();  
                    showFolderPicker(selectedPath);  // Show the next level
                }
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error selecting item: ${error.message}`);
            quickPick.hide();
        }
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
}


// async function showFolderPicker(currentPath: string) {
//     const quickPick = vscode.window.createQuickPick<MyQuickPickItem>();
//     quickPick.placeholder = 'Select a folder...';
    
//     // Aszinkron beolvasás és elemek létrehozása
//     try {
//         const files = await fs.readdir(currentPath);
//         quickPick.items = files.map(file => ({ 
//             label: file, 
//             fullPath: path.join(currentPath, file) 
//         }));
//     } catch (error) {
//         vscode.window.showErrorMessage(`Error reading directory: ${error.message}`);
//         quickPick.hide();
//         return;
//     }

//     quickPick.onDidAccept(async () => {
//         const selectedPath = quickPick.selectedItems[0].fullPath;
//         try {
//             // Ellenőrizzük, hogy a kiválasztott elem mappa-e
//             if ((await fs.stat(selectedPath)).isDirectory()) {
//                 // Mappa tartalmának betöltése
//                 showFolderPicker(selectedPath);
//             } else {
//                 // Ha fájl lett kiválasztva, bezárjuk a QuickPick-et
//                 quickPick.hide();
//             }
//         } catch (error) {
//             vscode.window.showErrorMessage(`Error selecting item: ${error.message}`);
//             quickPick.hide();
//         }
//     });

//     quickPick.onDidHide(() => quickPick.dispose());
//     quickPick.show();
// }

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
