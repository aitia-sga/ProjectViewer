
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

type Project = {
    name: string;
    directorys: Directory[];
};

type Directory = {
    name: string;
    files: File[];
};

type File = {
    fileName: string;
    absolutPath: string;
};

export function activate(context: vscode.ExtensionContext) {
    const projectsData = JSON.parse(fs.readFileSync(path.join(context.extensionPath, 'projects.json'), 'utf8'));
    const extrasProvider = new ExtrasTreeProvider(projectsData.projects);
    vscode.window.registerTreeDataProvider('extrasView', extrasProvider);
}

class ExtrasTreeProvider implements vscode.TreeDataProvider<Project | Directory | File> {
    constructor(private projects: Project[]) {}

    getTreeItem(element: Project | Directory | File): vscode.TreeItem {
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

    getChildren(element?: Project | Directory | File): Thenable<(Project | Directory | File)[]> {
        if (!element) {
            return Promise.resolve(this.projects);
        } else if ('directorys' in element) {
            return Promise.resolve(element.directorys);
        } else if ('files' in element) {
            return Promise.resolve(element.files);
        } else {
            return Promise.resolve([]);
        }
    }
}
