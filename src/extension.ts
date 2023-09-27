
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

export function activate(context: vscode.ExtensionContext) {
    const filesProvider = new FilesTreeProvider();
    vscode.window.registerTreeDataProvider('filesView', filesProvider);

    const extrasProvider = new ExtrasTreeProvider();
    vscode.window.registerTreeDataProvider('extrasView', extrasProvider);
}

class FilesTreeProvider implements vscode.TreeDataProvider<string> {
    getTreeItem(element: string): vscode.TreeItem {
        return {
            label: element,
            collapsibleState: element.startsWith('Folder') ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        };
    }

    getChildren(element?: string): Thenable<string[]> {
        if (!element) {
            return Promise.resolve(['Folder 1', 'Folder 2', 'File 1']);
        } else if (element.startsWith('Folder')) {
            return Promise.resolve(['File A', 'File B']);
        } else {
            return Promise.resolve([]);
        }
    }
}

class ExtrasTreeProvider implements vscode.TreeDataProvider<string> {
    getTreeItem(element: string): vscode.TreeItem {
        return {
            label: element,
            collapsibleState: vscode.TreeItemCollapsibleState.None
        };
    }

    getChildren(element?: string): Thenable<string[]> {
        if (!element) {
            return Promise.resolve(['Extra 1', 'Extra 2', 'Extra 3']);
        } else {
            return Promise.resolve([]);
        }
    }
}
