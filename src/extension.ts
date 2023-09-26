// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as projects from './projects';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const myProjects = new projects.MyProjects('/home/strabi/Munkak/AITIA/StrahlExlorer/projectviewer/projects.json');

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.projectviewer.addToProject', (fileUri: vscode.Uri) => {
			if (fileUri) {
				vscode.window.showInformationMessage(`Adding ${fileUri.fsPath} to project.`);

				// Itt add hozzá a fájlt a projekthez vagy végezz el bármilyen egyéb műveletet
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
