
/*
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as projects from './projects';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const myProjects = new projects.MyProjects('/home/strabi/Munkak/AITIA/StrahlExlorer/projectviewer/projects.json');

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.projectviewer.addToProject', (fileUri: vscode.Uri) => {
			if (fileUri) {
				vscode.window.showInformationMessage(`Adding ${path.basename(fileUri.fsPath)} to project.`);
				myProjects.addFileToProject("Proj3", "P3D1", fileUri.fsPath, path.basename(fileUri.fsPath));
			}
		}),
		
		vscode.commands.registerCommand('extension.projectviewer.newProject', async () => {
			vscode.window.showInformationMessage('A gombot megnyomták!');
			
			const userInput = await vscode.window.showInputBox({
				prompt: 'Add your input hereddd',
				placeHolder: 'Placeholder text'
			});
			
			if (userInput) {
				vscode.window.showInformationMessage(`You entered: ${userInput}`);
				myProjects.createNewProject(userInput);
			} else {
				vscode.window.showInformationMessage('No input provided');
			}
	
		})
	
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const projectsData = JSON.parse(fs.readFileSync(path.join(context.extensionPath, 'projects.json'), 'utf8'));

    const activeProjectsPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, '.vscode', 'activeProjects.json');
    let activeProjectsData: { activeProjects: string[] };
    try {
        activeProjectsData = JSON.parse(fs.readFileSync(activeProjectsPath, 'utf8'));
    } catch {
        activeProjectsData = { activeProjects: [] };
    }

    const projectsProvider = new ProjectsTreeProvider(projectsData.projects);
    vscode.window.registerTreeDataProvider('projectsView', projectsProvider);

    const activeProjectsProvider = new ActiveProjectsTreeProvider(projectsData.projects, activeProjectsData.activeProjects);
    vscode.window.registerTreeDataProvider('activeProjectsView', activeProjectsProvider);

    context.subscriptions.push(
		vscode.commands.registerCommand('projectViewer.addProjectToActive', (project) => {
			if (!activeProjectsData.activeProjects.includes(project.name)) {
				activeProjectsData.activeProjects.push(project.name);
				fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4));
				activeProjectsProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('projectviewer.newProject', async () => {
			vscode.window.showInformationMessage('A gombot megnyomták!');
			
			const userInput = await vscode.window.showInputBox({
				prompt: 'Add your input here',
				placeHolder: 'Placeholder text'
			});
			
			if (userInput) {
				vscode.window.showInformationMessage(`You entered: ${userInput}`);

				// Új projekt hozzáadása a projects listához
				const newProject = {
					name: userInput,
					directorys: [],
					// files: []
				};
				projectsData.projects.push(newProject);

				// Új projekt elmentése a projects.json fájlba
				fs.writeFileSync(path.join(context.extensionPath, 'projects.json'), JSON.stringify(projectsData, null, 4));

				// Frissíti a treeview-t az új projekttel
				projectsProvider.refresh();

			} else {
				vscode.window.showInformationMessage('No input provided');
			}
	
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
