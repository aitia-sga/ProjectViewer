
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// export type File = {
// 	fileName: string;
// 	absolutPath: string;
// 	logicalPath: string;
// };

export type Directory = {
	name: string;
	files: File[];
};

// export type Project = {
// 	name: string;
// 	directorys: Directory[];
// };

type ProjectsJSON = {
	projects: Project[];
};


export type Item = {
	name: string;
	type: string;
	items: Item[];
};

// type Project = Item;
export interface Project extends Item {}
export interface LogicalDirectory extends Item {}
export interface File extends Item { absolutPath: string; }

export class MyProjects {

	jsonPath: string;
	jsonData: Project[];

	constructor(jsonPath: string) {
		this.jsonPath = jsonPath;

		try { 
			const jsonString = fs.readFileSync(jsonPath, 'utf-8');

			const filteredString = jsonString.split('\n').filter(line => !line.trim().startsWith('//'));
			try { this.jsonData = JSON.parse(filteredString.join('\n')); }
			catch { this.jsonData = []; }
		
		}
		catch { this.jsonData = []; }
	}
	
	getProjects(): Project[] {
		return this.jsonData;
	}

	importProjects(importedProjects: Project[]): void {
		importedProjects.forEach(element => {
			if(!this.projectExists(element.name))
				this.jsonData.push(element);
			else
				vscode.window.showInformationMessage(`Project ${element.name} already exists!`);
		});

		fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
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

	createNewProject(projectName: string): void {
		if(this.projectExists(projectName)) 
			vscode.window.showInformationMessage(`Project ${projectName} already exists!`);

		else {
			const newProject: Item = {
				name: projectName,
				type: "project",
				items: []
			};
			
			this.jsonData.push(newProject);
		
			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
		}
	}

	deleteProject(deletedProject: Project): void {
		const projectIndex = this.jsonData.indexOf(deletedProject);
		if(projectIndex !== -1)
		{
			this.jsonData.splice(projectIndex, 1);
			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
		}
	}

	containsProject(proj: Project): boolean {
		return this.jsonData.includes(proj);
	}

	createNewFolder(parent: Item, newDirectory: string):void  {
		if(this.directoryExists(parent, newDirectory)) 
			vscode.window.showInformationMessage(`Directory ${newDirectory} already exists!`);
		
		else {
			const newDir: LogicalDirectory = {
				name: newDirectory,
				type: "logicalDirectory",
				items: []
			};

			parent.items.push(newDir)
			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
		}
	}

	removeObjectFromProject(removedObject: Item): void {
		this.jsonData.forEach(element => {
			if(this.removeObject(element, removedObject)) {
				fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
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
		fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
	}

	addFileToProject(locicalDirectory: Item, fileUri: vscode.Uri, itemType: string): void {
		const newFile: File = {
			name: path.basename(fileUri.fsPath),
			type: itemType,
			items: [],
			absolutPath: fileUri.fsPath
		};

		if(this.projectContainsTheFile(locicalDirectory, newFile)) {
			vscode.window.showInformationMessage(`Directory already contains the ${newFile.name} file!`);
		} else {
			locicalDirectory.items.push(newFile);
			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
		}
	}
}
