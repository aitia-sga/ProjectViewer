
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

interface ActiveProjectsData {
    activeProjects: string[];
}

function activate(context: vscode.ExtensionContext) {
    const projectsData = JSON.parse(fs.readFileSync(path.join(context.extensionPath, 'projects.json'), 'utf8'));
    const extrasProvider = new ExtrasTreeProvider(projectsData.projects);
    vscode.window.registerTreeDataProvider('projectsView', extrasProvider);

    const activeProjectsProvider = new ActiveProjectsProvider();
    vscode.window.registerTreeDataProvider('activeProjectsView', activeProjectsProvider);

    const activeProjectsPath = path.join(vscode.workspace.rootPath || '', '.vscode', 'activeProjects.json');

    context.subscriptions.push(vscode.commands.registerCommand('projectViewer.addToActiveProjects', async (project: any) => {
        let activeProjectsData: ActiveProjectsData = { activeProjects: [] };

	if (fs.existsSync(activeProjectsPath)) {
		activeProjectsData = JSON.parse(fs.readFileSync(activeProjectsPath, 'utf8')) as ActiveProjectsData;
	}

	if (!activeProjectsData.activeProjects.includes(project.name)) {
		activeProjectsData.activeProjects.push(project.name);
		fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4));
	}

        // Refresh the active projects view
        activeProjectsProvider.refresh();
    }));
}

export { activate };

class ExtrasTreeProvider implements vscode.TreeDataProvider<any> {
    constructor(private projects: any[]) {}

    getTreeItem(element: any): vscode.TreeItem {
        return {
            label: element.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'projectItem'
        };
    }

    getChildren(element?: any): Thenable<any[]> {
        if (!element) {
            return Promise.resolve(this.projects);
        } else {
            return Promise.resolve([]);
        }
    }
}

class ActiveProjectsProvider implements vscode.TreeDataProvider<string> {
    private _onDidChangeTreeData: vscode.EventEmitter<string | null> = new vscode.EventEmitter<string | null>();
    readonly onDidChangeTreeData: vscode.Event<string | null> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }

    get activeProjects(): string[] {
        const activeProjectsPath = path.join(vscode.workspace.rootPath || '', '.vscode', 'activeProjects.json');
        if (fs.existsSync(activeProjectsPath)) {
            return JSON.parse(fs.readFileSync(activeProjectsPath, 'utf8')).activeProjects;
        }
        return [];
    }

    getTreeItem(element: string): vscode.TreeItem {
        return {
            label: element,
            collapsibleState: vscode.TreeItemCollapsibleState.None
        };
    }

    getChildren(element?: string): Thenable<string[]> {
        if (!element) {
            return Promise.resolve(this.activeProjects);
        }
        return Promise.resolve([]);
    }
}
