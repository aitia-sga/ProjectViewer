
import * as vscode from 'vscode';
import * as fs from 'fs';

type File = {
	absolutPath: string;
	relativePath: string;
};

type Project = {
	name: string;
	files: File[];
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

	projectExists(projectName: string): boolean {
		return this.jsonData.projects.some(project => project.name === projectName);
	}

	projectContainsTheFile(projectName: string, absPath: string, relPath: string): boolean {
		const proj: Project | undefined = this.jsonData.projects.find(project => project.name === projectName);

		if(!proj)
			return true;

		if(proj.files.some(file => file.relativePath !== relPath))
			return false;

		//TODO: Other file with each relativ path. Swap?
		// if(proj.files.some(file => file.absolutPath === absPath))
		// 	return true;

		return true;
	}

	createNewProject(projectName: string): void {
		if(this.projectExists(projectName)) 
			vscode.window.showInformationMessage(`A project called ${projectName} already exists!`);

		else {

			const newProject: Project = {
				name: projectName,
				files: []
			};
			
			this.jsonData.projects.push(newProject);
		
			const updatedJsonString: string = JSON.stringify(this.jsonData, null, 2);
			fs.writeFileSync(this.jsonPath, updatedJsonString, 'utf-8');
		}
	}

	addFileToProject(projectName: string, absPath: string, relPath: string): void {

	}
}

