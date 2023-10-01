
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as projects from './projects';

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
				projectsProvider.refresh(); activeProjectsProvider.refresh()
			} else
				vscode.window.showInformationMessage('No input provided');	
        }),

		vscode.commands.registerCommand('projectViewer.newProject', async () => {
			const userInput = await vscode.window.showInputBox({
				prompt: 'Add your input here',
				placeHolder: 'Placeholder text'
			});
			
			if (userInput) {
				myProjects.createNewProject(userInput);
				projectsProvider.refresh();
			} else
				vscode.window.showInformationMessage('No input provided');	
		}),

		vscode.commands.registerCommand('projectViewer.addToProject', async (fileUri: vscode.Uri) => {

            let selectedProject;

			if (!fileUri)  { vscode.window.showErrorMessage('fileUri is empty!'); return; }
            
            const projectNames = myProjects.getProjects().map(project => project.name);
            const selectedProjectName = await vscode.window.showQuickPick(projectNames, {placeHolder: 'Please select the project!'});
            
            if (selectedProjectName) {
                selectedProject = myProjects.getProjects().find(project => project.name === selectedProjectName);
                if (!selectedProject) { vscode.window.showErrorMessage('The selected project cannot be found!'); return; }
                
                
            } else return;
            
            const directoryNames = selectedProject.directorys.map(directory => directory.name);
            const selectedDirectoryName = await vscode.window.showQuickPick(directoryNames, {placeHolder: 'Please select the directory!'});
            
            if (!selectedDirectoryName) return;

            myProjects.addFileToProject(selectedProjectName, selectedDirectoryName, fileUri.fsPath, path.basename(fileUri.fsPath));
            activeProjectsProvider.refresh();
		}),

        vscode.commands.registerCommand('projectViewer.removeFromProject', async (removedFile: projects.File) => {
            myProjects.removeFileFromProject(removedFile);
            activeProjectsProvider.refresh();
        })
	);
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
        if ('directorys' in element) {
            return {
                label: element.name,
				contextValue: 'activeProject',
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
            };
        } else if ('files' in element) {
            return {
                label: element.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
            };
        } else if ('name' in element && !('directorys' in element)) {
            return {
                label: element.name,
                collapsibleState: vscode.TreeItemCollapsibleState.None
            };
        } else {
            return {
                label: element.fileName,
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
        } else if ('directorys' in element) {
            return Promise.resolve(element.directorys);
        } else if ('files' in element) {
            return Promise.resolve(element.files);
        } else {
            return Promise.resolve([]);
        }
    }
}
