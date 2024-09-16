
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsProm from 'fs/promises';
import * as path from 'path';
import * as projects from './projects';


interface MyQuickPickItem extends vscode.QuickPickItem { item: projects.Item; }

let sharedTerminal: vscode.Terminal | undefined;

export async function activate(context: vscode.ExtensionContext) {
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


	const isAitiaProject = vsCodeFolder.includes('aitia');
	vscode.commands.executeCommand('setContext', 'aitiaProject', isAitiaProject);

	const projectsPath = path.join(vsCodeFolder, 'projects.json');
	const activeProjectsPath = path.join(vsCodeFolder, 'activeProjects.json');

	if(!fs.existsSync(projectsPath))
		fs.writeFileSync(projectsPath, "");

	if(!fs.existsSync(activeProjectsPath))
		fs.writeFileSync(activeProjectsPath, "");

	const myProjects = new projects.MyProjects(projectsPath);
	const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;

	const directories = await findProjectDirectories(workspaceRoot);

	let activeProjectsData: { activeProjects: string[] };
	try {
		const filteredString = fs.readFileSync(activeProjectsPath, 'utf8').split('\n').filter(line => !line.trim().startsWith('//'));
		activeProjectsData = JSON.parse(filteredString.join('\n'));
	} catch {
		activeProjectsData = { activeProjects: [] };
	}

	const templateProjectsProvider = new TemplateProjectsTreeProvider(directories);
	if(isAitiaProject) {
		vscode.window.registerTreeDataProvider('templateProjectsView', templateProjectsProvider);
	}

	const projectsProvider = new ProjectsTreeProvider(myProjects.getProjects());
	vscode.window.registerTreeDataProvider('projectsView', projectsProvider);

	const activeProjectsProvider = new ActiveProjectsTreeProvider(myProjects.getProjects(), activeProjectsData.activeProjects);
	vscode.window.registerTreeDataProvider('activeProjectsView', activeProjectsProvider);
	
	const projectsWatcher = fs.watch(projectsPath, (eventType, filename) => {
		if (filename) {
			myProjects.updateProjects();
			// normalizeActiveProjects(myProjects.getProjects(), activeProjectsData, activeProjectsPath);
			projectsProvider.updateProjects(myProjects.getProjects());
			activeProjectsProvider.updateProjects(myProjects.getProjects());
		}
	});

	context.subscriptions.push({
		dispose: () => projectsWatcher.close()
	});

	const activeProjectsWatcher = fs.watch(activeProjectsPath, (eventType, filename) => {
		if (filename) {
			try {
				const filteredString = fs.readFileSync(activeProjectsPath, 'utf8').split('\n').filter(line => !line.trim().startsWith('//'));
				activeProjectsData = JSON.parse(filteredString.join('\n'));
			} catch {
				activeProjectsData = { activeProjects: [] };
			}

			activeProjectsProvider.updateActiveProjects(activeProjectsData.activeProjects);
		}
	});

	context.subscriptions.push({
		dispose: () => activeProjectsWatcher.close()
	});

	let statusBarGoToExplorer = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3);
	statusBarGoToExplorer.text =  `$(files) Explorer`;
	statusBarGoToExplorer.tooltip = 'Go to Explorer';
	statusBarGoToExplorer.command = 'projectViewer.jumpToExplorer';
	statusBarGoToExplorer.show();
	context.subscriptions.push(statusBarGoToExplorer);

	let statusBarGoToProjectViewer = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
	statusBarGoToProjectViewer.text =  `$(folder) Project Viewer`;
	statusBarGoToProjectViewer.tooltip = 'Go to Project Viewer';
	statusBarGoToProjectViewer.command = 'projectViewer.jumpToProjectViewer';
	statusBarGoToProjectViewer.show();
	context.subscriptions.push(statusBarGoToProjectViewer);

	context.subscriptions.push(
		vscode.commands.registerCommand('projectViewer.jumpToExplorer', () => {
			vscode.commands.executeCommand('workbench.view.explorer');
		}),

		vscode.commands.registerCommand('projectViewer.jumpToProjectViewer', () => {
			vscode.commands.executeCommand('workbench.view.extension.projectViewer');
		}),
		
		vscode.commands.registerCommand('projectViewer.addProjectToActive', (project: projects.Project) => {
			if (!activeProjectsData.activeProjects.includes(project.name)) {
				activeProjectsData.activeProjects.push(project.name);
				try { fs.writeFileSync(activeProjectsPath, JSON.stringify(activeProjectsData, null, 4)); } catch {}
				activeProjectsProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('projectViewer.removeProjectFromActive', (project: projects.Project) => {
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
				const debugConfName = await debugConfNameRequest();
				const otherScript = await otherScriptRequest();

				myProjects.createNewProject(userInput, description, debugConfName, otherScript);
				projectsProvider.refresh();
			} else
				vscode.window.showInformationMessage('No input provided');	
		}),

		vscode.commands.registerCommand('projectViewer.newProjectFromTemplate', async (template) => {
			const userInput = await vscode.window.showInputBox({
				prompt: 'Enter the name of the project',
				placeHolder: 'Project name'
			});
			
			if (userInput) {
				const description = await descriptionRequest();
				const debugConfName = await debugConfNameRequest();
				const otherScript = await otherScriptRequest();
				const projectFile = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, template, 'project', 'logicalView.json');
				
				if(fs.existsSync(projectFile) && fs.statSync(projectFile).size > 0) {
					const importedProjects = new projects.MyProjects(projectFile);
					myProjects.importProjects(importedProjects.getProjects(), userInput, description, template);
					projectsProvider.refresh();
				}
				else
					myProjects.createNewProject(userInput, description, debugConfName, otherScript, template);

				projectsProvider.refresh();
			} else
				vscode.window.showInformationMessage('No input provided');	
		}),

		vscode.commands.registerCommand('projectViewer.deleteProject', async (deletedProject) => {
			const result = await vscode.window.showInformationMessage(
				'Are you sure you want to delete this project?', { modal: true }, 'Yes');
				
				if (result === 'Yes') {
					myProjects.deleteProject(deletedProject);
					projectsProvider.refresh();
					
					const projectIndex = activeProjectsData.activeProjects.indexOf(deletedProject.name);
					if(projectIndex !== -1) {
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
					try {
						fs.writeFileSync(uri.fsPath, JSON.stringify(myProjects.getProjects().filter(project => project == exportedProject), null, 4));
						vscode.window.showInformationMessage('Project exported successfully!');
					} catch { vscode.window.showInformationMessage('Project export cancelled.'); }
				} else
					vscode.window.showInformationMessage('Project export cancelled.');				
			}),
			
		vscode.commands.registerCommand('projectViewer.createNewFolder', async (project: projects.Project) => {
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
		}),

		vscode.commands.registerCommand('projectViewer.buildAppDebug', (project: projects.Project) => {
			runComand(workspaceRoot, 'build.sh', 'debug', project.template);
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAppAndLibsDebug', (project: projects.Project) => {
			runComand(workspaceRoot, 'buildAppAndAllLib.sh', 'debug', project.template);
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAppRelease', (project: projects.Project) => {
			runComand(workspaceRoot, 'build.sh', 'release', project.template);
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAppAndLibsRelease', (project: projects.Project) => {
			runComand(workspaceRoot, 'buildAppAndAllLib.sh', 'release', project.template);
		}),
		
		vscode.commands.registerCommand('projectViewer.debug', (project: projects.Project) => {
			startDebugging(project.debugConfName);
		}),
		
		vscode.commands.registerCommand('projectViewer.showLog', (project: projects.Project) => {
			const splitted = project.template.split('/');

			runComand(workspaceRoot, 'showsyslog.sh', splitted[splitted.length-1]);
		}),
		
		vscode.commands.registerCommand('projectViewer.runOtherScript', (project: projects.Project) => {
			runOtherScript(workspaceRoot, project.otherScript);
		}),
		

		vscode.commands.registerCommand('projectViewer.buildAllAppDebug', () => {
			runComand(workspaceRoot, 'buildAllApp.sh', 'debug');
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAllLibDebug', () => {
			runComand(workspaceRoot, 'buildAllLib.sh', 'debug');
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAllContribDebug', () => {
			runComand(workspaceRoot, 'buildAllContrib.sh', 'debug');
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAllDebug', () => {
			runComand(workspaceRoot, 'buildAll.sh', 'debug');
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAllAppRelease', () => {
			runComand(workspaceRoot, 'buildAllApp.sh', 'release');
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAllLibRelease', () => {
			runComand(workspaceRoot, 'buildAllLib.sh', 'release');
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAllContribRelease', () => {
			runComand(workspaceRoot, 'buildAllContrib.sh', 'release');
		}),
		
		vscode.commands.registerCommand('projectViewer.buildAllRelease', () => {
			runComand(workspaceRoot, 'buildAll.sh', 'release');
		}),
		
		vscode.commands.registerCommand('projectViewer.refreshTemplateList', () => {
			if(isAitiaProject)
				templateProjectsProvider.updateProjects(workspaceRoot);
		}),
		
		vscode.commands.registerCommand('projectViewer.cleanAll', async () => {
			const result = await vscode.window.showInformationMessage(
				'Are you sure you want to clean all?', { modal: true }, 'Yes');
				
			if (result === 'Yes')
				runComand(workspaceRoot, 'cleanAll.sh');
		}),
		
		vscode.commands.registerCommand('projectViewer.modifyDebugConf', async (project: projects.Project) => {
			const options: vscode.InputBoxOptions = {
				prompt: "Enter the new debug configuration name",
				placeHolder: 'Debug configuration name',
				value: project.debugConfName
			};

			let newDebugConfName = await vscode.window.showInputBox(options);
			if(!newDebugConfName) newDebugConfName = '';

			if(newDebugConfName !== project.debugConfName) {
				myProjects.modifyDebugConfName(project, newDebugConfName);
				projectsProvider.refresh();	
			}
		}),
		
		vscode.commands.registerCommand('projectViewer.modifyOtherScript', async (project: projects.Project) => {
			const options: vscode.InputBoxOptions = {
				prompt: "Enter the new other script file with relative path",
				placeHolder: 'Other script file with relative path',
				value: project.otherScript
			};
			
			let newOtherScript = await vscode.window.showInputBox(options);
			if(!newOtherScript) newOtherScript = '';
			
			if(newOtherScript !== project.otherScript) {
				myProjects.modifyOtherScript(project, newOtherScript);
				projectsProvider.refresh();	
			}
		}),

		vscode.commands.registerCommand('projectViewer.updateTemplate', async (exportedProject: projects.Project) => {
			if(!exportedProject || !exportedProject.template || !isAitiaProject)
				return;

			const result = await vscode.window.showInformationMessage(
				'Are you sure you want to update template project?', { modal: true }, 'Yes');
				
			if (result === 'Yes') {
				const template = path.join(workspaceRoot, exportedProject.template, 'project/logicalView.json');				

				try {
					// fs.writeFileSync(template, JSON.stringify(myProjects.getProjects().filter(project => project == exportedProject), null, 4));
					const proj = myProjects.getProjects().filter(project => project == exportedProject);

					fs.writeFileSync(template, JSON.stringify(proj, null, 4));
					vscode.window.showInformationMessage('Update template successfully!');
				} catch {}
			}			
		}),

		vscode.commands.registerCommand('projectViewer.reloadTemplate', async (reloadedProject: projects.Project) => {
			if(!reloadedProject || !reloadedProject.template || !isAitiaProject)
				return;

			const result = await vscode.window.showInformationMessage(
				'Are you sure you want to reload template project?', { modal: true }, 'Yes');
				
			if (result === 'Yes') {
				const projectName = reloadedProject.name;
				const description = reloadedProject.description;
				const debugConfName = reloadedProject.debugConfName;
				const otherScript = reloadedProject.otherScript;
				
				// Delete project
				myProjects.deleteProject(reloadedProject);
				
				// Reimport project
				const projectFile = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, reloadedProject.template, 'project', 'logicalView.json');
				
				if(fs.existsSync(projectFile) && fs.statSync(projectFile).size > 0) {
					const importedProjects = new projects.MyProjects(projectFile);
					myProjects.importProjects(importedProjects.getProjects(), projectName, description, reloadedProject.template);
				}
				else
					myProjects.createNewProject(projectName, description, debugConfName, otherScript, reloadedProject.template);
			
				projectsProvider.refresh();
			}		
		}),
	);
}

async function findProjectDirectories(rootDir: string, relativePath: string = ''): Promise<string[]> {
    let projectDirectories: string[] = [];

    const entries = await fsProm.readdir(path.join(rootDir, relativePath), { withFileTypes: true });
    for (const entry of entries) {
		if (entry.isDirectory()) {
            if (entry.name === 'project') {
				projectDirectories.push(relativePath);
            } else {
				const entryRelativePath = path.join(relativePath, entry.name);
                const subDirectories = await findProjectDirectories(rootDir, entryRelativePath);
                projectDirectories = projectDirectories.concat(subDirectories);
            }
        }
    }

    return projectDirectories;
}

async function descriptionRequest(): Promise<string> {
	const userInput = await vscode.window.showInputBox({
		prompt: 'Enter the description, or press Enter!',
		placeHolder: 'Description'
	});
	
	if (userInput)
		return userInput;

	return '';
}

async function debugConfNameRequest(): Promise<string> {
	const userInput = await vscode.window.showInputBox({
		prompt: 'Enter the debug configuration name, or press Enter!',
		placeHolder: 'Debug configuration'
	});
	
	if (userInput)
		return userInput;

	return '';
}

async function otherScriptRequest(): Promise<string> {
	const userInput = await vscode.window.showInputBox({
		prompt: 'Enter the other script name with relative path, or press Enter!',
		placeHolder: 'Other script'
	});
	
	if (userInput)
		return userInput;

	return '';
}

function showItemPicker(items: projects.Item[], isRoot = true): Promise<projects.Item | undefined> {
	return new Promise((resolve, reject) => {
		const quickPick = vscode.window.createQuickPick<MyQuickPickItem>();
		
		quickPick.items = isRoot 
			? items.map(item => ({ label: item.name, item })).filter(item => item.item.type === 'logicalDirectory' || item.item.type === 'project')
			: [
				{ label: `Select current directory`, item: { name: 'Current', type: 'current', description: '', ordering: 'auto', items: [] } },
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

function runComand(workspace: string, command: string, mode: string = '', project: string = ''): void {

	if(!command || !command.length)
		return;

	const scriptPath = path.join(workspace, 'scripts', command);

	let script = scriptPath;

	if(project && project.length)
		script += ' ' + project; 
	
	if(mode && mode.length)
		script += ' ' + mode; 

	console.log(`Call ${script}`);

	if(!sharedTerminal)
		sharedTerminal = vscode.window.createTerminal('Project viewer');
	
	sharedTerminal.show();
	sharedTerminal.sendText(script);
}

function runOtherScript(workspace: string, script: string): void {

	if(!script || !script.length)
		return;

	const scriptPath = path.join(workspace, script);

	console.log(`Call ${script}`);

	if(!sharedTerminal)
		sharedTerminal = vscode.window.createTerminal('Project viewer');

	sharedTerminal.show();
	sharedTerminal.sendText(scriptPath);
}

function startDebugging(debugConfigurationName: string) {
	if(debugConfigurationName && debugConfigurationName.length)
		vscode.debug.startDebugging(vscode.workspace.workspaceFolders![0], debugConfigurationName);
	else
		console.log('debugConfigurationName is empty');
}

function normalizeActiveProjects(projects: projects.Project[], actProjData: any, path: fs.PathOrFileDescriptor): void {
	let needRefreshFile = false;

	for (let i = 0; i < actProjData.activeProjects.length; i++) {
		if(!projects.some(proj => proj.name === actProjData.activeProjects[i])) {
			actProjData.activeProjects.splice(i, 1); needRefreshFile = true;
		}
	}

	if(needRefreshFile) {
		try { fs.writeFileSync(path, JSON.stringify(actProjData, null, 4)); } catch {}
	}
}

class TemplateProjectsTreeProvider implements vscode.TreeDataProvider<any> {
	private _onDidChangeTreeData: vscode.EventEmitter<any | undefined> = new vscode.EventEmitter<any | undefined>();
	readonly onDidChangeTreeData: vscode.Event<any | undefined> = this._onDidChangeTreeData.event;

	constructor(private templateProjects: string[]) {}

	refresh(element?: any): void {
		this._onDidChangeTreeData.fire(element);
	}

	async updateProjects(workspaceRoot: string) {
		this.templateProjects = await findProjectDirectories(workspaceRoot);
		this.refresh();
	}

	getTreeItem(element: any): vscode.TreeItem {
		return {
			label: element,
			contextValue: 'project',
			iconPath: new vscode.ThemeIcon(element.icon ? element.icon : 'project'),
			collapsibleState: vscode.TreeItemCollapsibleState.None,
		};
	}

	getChildren(element?: any): Thenable<any[]> {
		if (!element) {
			return Promise.resolve(this.templateProjects.sort());
		}
		return Promise.resolve([]);
	}
}


class ProjectsTreeProvider implements vscode.TreeDataProvider<any> {
	private _onDidChangeTreeData: vscode.EventEmitter<any | undefined> = new vscode.EventEmitter<any | undefined>();
	readonly onDidChangeTreeData: vscode.Event<any | undefined> = this._onDidChangeTreeData.event;

	constructor(private projects: projects.Project[]) {}

	refresh(element?: any): void {
		this._onDidChangeTreeData.fire(element);
	}

	updateProjects(projects: projects.Project[]) {
		this.projects = projects;
		this.refresh();
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

	updateProjects(projectsData: projects.Project[]) {
		this.projectsData = projectsData;
		this.refresh();
	}

	updateActiveProjects(activeProjectsNames: string[]) {
		this.activeProjectsNames = activeProjectsNames;
		this.refresh();
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
			// Ordered
			// return Promise.resolve(this.projectsData.filter((project: any) => this.activeProjectsNames.includes(project.name))
			// .sort((a, b) => this.elementCompare(a, b)));

			// Don't ordered
			return Promise.resolve(this.projectsData.filter((project: any) => this.activeProjectsNames.includes(project.name)));

		} else if (element.type === 'project' || element.type === 'logicalDirectory') {
			if(element.ordering === 'manual')
				return Promise.resolve(element.items);
			else
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

						if(element.ordering === 'manual')
							resolve(items);
						else
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
