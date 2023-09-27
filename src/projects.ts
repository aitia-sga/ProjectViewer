
import * as vscode from 'vscode';
import * as fs from 'fs';

type File = {
	fileName: string;
	absolutPath: string;
};

type Directory = {
	name: string;
	files: File[];
};

type Project = {
	name: string;
	directorys: Directory[];
};

type ProjectsJSON = {
	projects: Project[];
};

export class MyProjects {

	jsonPath: string;
	jsonString: string;
	jsonData: ProjectsJSON;

	constructor(jsonPath: string) {
		this.jsonPath = jsonPath;

		this.jsonString = fs.readFileSync(jsonPath, 'utf-8');
		this.jsonData = JSON.parse(this.jsonString);
	}

	getProjects(): Project[] {
		return this.jsonData.projects;
	}

	projectExists(projectName: string): boolean {
		return this.jsonData.projects.some(project => project.name === projectName);
	}

	projectContainsTheFile(projectName: string, directory: string, absPath: string, fileName: string): boolean {
		const proj: Project | undefined = this.jsonData.projects.find(project => project.name === projectName);

		if(!proj) { console.error(`Cannot find ${projectName} project!`); return true; }

		const dir: Directory | undefined = proj.directorys.find(item => item.name === directory);

		if(!dir) { console.error(`Cannot find ${directory} directory!`); return true; }

		return dir.files.some(file => file.fileName === fileName && file.absolutPath === absPath);

		// if(dir.files.some(file => file.fileName !== fileName))
		// 	return false;

		//TODO: Other file with each relativ path. Swap?
		// if(dir.files.some(file => file.absolutPath === absPath))
		// 	return true;

		// return true;
	}

	createNewProject(projectName: string): void {
		if(this.projectExists(projectName)) 
			vscode.window.showInformationMessage(`A project called ${projectName} already exists!`);

		else {
			const newProject: Project = {
				name: projectName,
				directorys: []
			};
			
			this.jsonData.projects.push(newProject);
		
			const updatedJsonString: string = JSON.stringify(this.jsonData, null, 2);
			fs.writeFileSync(this.jsonPath, updatedJsonString, 'utf-8');
		}
	}

	addFileToProject(projectName: string, directory: string, absPath: string, fileName: string): void {
		if(this.projectContainsTheFile(projectName, directory, absPath, fileName))
			vscode.window.showInformationMessage(`The given directory already contains this file!`);
		else
		{
			const newFile: File = {
				fileName: fileName,
				absolutPath: absPath
			};

			this.jsonData.projects.find(project => project.name === projectName)
			?.directorys.find(item => item.name === directory)?.files.push(newFile);

			const updatedJsonString: string = JSON.stringify(this.jsonData, null, 2);
			fs.writeFileSync(this.jsonPath, updatedJsonString, 'utf-8');
		}
	}
}

