
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


export type Item = {
	name: string;
	type: string;
	items: Item[];
	description: string;
};

export interface Project extends Item {}
export interface LogicalDirectory extends Item {}
export interface File extends Item { absolutPath: string; }

export class MyProjects {

	jsonPath: string = "";
	jsonData: Project[] = [];

	constructor(jsonPath: string) {
		this.jsonPath = jsonPath;
		this.updateProjects();
	}
	
	getProjects(): Project[] {
		return this.jsonData;
	}

	updateProjects(): void {
		
		try { 
			let jsonString = fs.readFileSync(this.jsonPath, 'utf-8');
			let workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;

			jsonString = jsonString.replace(/\$\{workspaceFolder\}/g, workspacePath);
			jsonString = path.normalize(jsonString).replace(/\\/g, '/');

			const filteredString = jsonString.split('\n').filter(line => !line.trim().startsWith('//'));
			try { this.jsonData = JSON.parse(filteredString.join('\n')); }
			catch { this.jsonData = []; }
		}
		catch { this.jsonData = []; }
	}

	importProjects(importedProjects: Project[]): void {
		importedProjects.forEach(element => {
			if(!this.projectExists(element.name))
				this.jsonData.push(element);
			else
				vscode.window.showInformationMessage(`Project ${element.name} already exists!`);
		});

		this.writeProjectsToFile()
	} 

	projectExists(projectName: string): boolean {
		return this.jsonData.some(project => project.name === projectName);
	}

	directoryExists(actItem: Item, newDirectory: string): boolean {
		return actItem.items.some(directory => directory.name === newDirectory);
	}

	projectContainsTheFile(locicalDirectory: Item, newFile: File): boolean {
		return locicalDirectory.items.some(file => (file as File).absolutPath === newFile.absolutPath);
	}

	renameAvailable(renamedItem: Item, newName: string): boolean {
		if(renamedItem.type == 'project')
			return !this.projectExists(newName);

		return true;
	}

	createNewProject(projectName: string, description: string): void {
		if(this.projectExists(projectName)) 
			vscode.window.showInformationMessage(`Project ${projectName} already exists!`);

		else {
			const newProject: Project = {
				name: projectName,
				type: "project",
				description: description,
				items: []
			};
			
			this.jsonData.push(newProject);
			this.writeProjectsToFile()
		}
	}

	deleteProject(deletedProject: Project): void {
		const projectIndex = this.jsonData.indexOf(deletedProject);
		if(projectIndex !== -1)
		{
			this.jsonData.splice(projectIndex, 1);
			this.writeProjectsToFile()
		}
	}

	containsProject(proj: Project): boolean {
		return this.jsonData.includes(proj);
	}

	createNewFolder(parent: Item, newDirectory: string, description: string):void  {
		if(this.directoryExists(parent, newDirectory)) 
			vscode.window.showInformationMessage(`Directory ${newDirectory} already exists!`);
		
		else {
			const newDir: LogicalDirectory = {
				name: newDirectory,
				type: "logicalDirectory",
				description: description,
				items: []
			};

			parent.items.push(newDir)
			this.writeProjectsToFile()
		}
	}

	removeObjectFromProject(removedObject: Item): void {
		this.jsonData.forEach(element => {
			if(this.removeObject(element, removedObject)) {
				this.writeProjectsToFile()
				return;
			}
		});
	}

	removeObject(obj: any, removedObj: any): boolean {
		if (!obj || typeof obj !== 'object')
		return false;
	
	if (Array.isArray(obj.items)) {
		for (let i = 0; i < obj.items.length; i++) {
			if (obj.items[i] === removedObj) {
				obj.items.splice(i, 1);
				return true;
			}
			
				if (this.removeObject(obj.items[i], removedObj))
					return true;
			}
		}
		
		return false;
	}	
	
	renamedItem(renamedItem: Item, newName: string): void {
		renamedItem.name = newName;
		this.writeProjectsToFile()
	}

	modifyDescription(renamedItem: Item, newDescription: string): void {
		renamedItem.description = newDescription;
		this.writeProjectsToFile()
	}

	addFileToProject(locicalDirectory: Item, fileUri: vscode.Uri, itemType: string, description: string): void {
		const newFile: File = {
			name: path.basename(fileUri.fsPath),
			type: itemType,
			items: [],
			absolutPath: fileUri.fsPath,
			description: description
		};

		if(this.projectContainsTheFile(locicalDirectory, newFile)) {
			vscode.window.showInformationMessage(`Directory already contains the ${newFile.name} file!`);
		} else {
			locicalDirectory.items.push(newFile);
			this.writeProjectsToFile()
		}
	}

	writeProjectsToFile(): void {
		try {
			let jsonString = JSON.stringify(this.jsonData, null, 4);
			jsonString = path.normalize(jsonString);
			jsonString = jsonString.replace(/\\/g, '/');

			let workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
			workspacePath = path.normalize(workspacePath).replace(/\\/g, '/');
			jsonString = jsonString.replace(new RegExp(workspacePath, 'g'), '${workspaceFolder}');

			fs.writeFileSync(this.jsonPath, jsonString, 'utf-8');
		} catch {}
	}
}
