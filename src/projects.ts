
import * as vscode from 'vscode';
import * as fs from 'fs';

export type File = {
	fileName: string;
	absolutPath: string;
	logicalPath: string;
};

export type Directory = {
	name: string;
	files: File[];
};

export type Project = {
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

	directoryExists(proj: Project, newDirectory: string): boolean {
		return proj.directorys.some(directory => directory.name === newDirectory);
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
			vscode.window.showInformationMessage(`Project ${projectName} already exists!`);

		else {
			const newProject: Project = {
				name: projectName,
				directorys: []
			};
			
			this.jsonData.projects.push(newProject);
		
			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
		}
	}

	containsProject(proj: Project): boolean {
		return this.jsonData.projects.includes(proj);
	}

	createNewFolder(proj: Project, newDirectory: string):void  {

		if(this.directoryExists(proj, newDirectory)) 
			vscode.window.showInformationMessage(`Directory ${newDirectory} already exists!`);
		
		else {
			const newDir: Directory = {
				name: newDirectory,
				files: []
			};

			proj.directorys.push(newDir);
			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
		}
	}

	deleteFolderWithFiles(removedDirectory: Directory): void {
		const actProj = this.jsonData.projects.find(project => project.directorys.find(directory => directory === removedDirectory));

		delete actProj?.directorys[actProj.directorys.findIndex(directory => directory === removedDirectory)]
		fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
	}

	addFileToProject(projectName: string, directory: string, absPath: string, fileName: string): void {
		if(this.projectContainsTheFile(projectName, directory, absPath, fileName))
			vscode.window.showInformationMessage(`The given directory already contains this file!`);
		else
		{
			const newFile: File = {
				fileName: fileName,
				absolutPath: absPath,
				logicalPath: projectName + "/" + directory
			};

			this.jsonData.projects.find(project => project.name === projectName)
			?.directorys.find(item => item.name === directory)?.files.push(newFile);

			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
			// vscode.window.showInformationMessage(`Adding ${fileName} to project`);
		}
	}

	removeFileFromProject(removedFile: File): void {

	const actProj = this.jsonData.projects.find(project => project.directorys.
		find(directory => directory.files.find(file => file === removedFile)));

	// delete actProj?.directorys[actProj.directorys.findIndex(directory => directory.files.findIndex(file => file === removedFile))];

	delete actProj?.directorys[actProj.directorys.findIndex(directory => directory.files.findIndex(file => file === removedFile))];


	}
}

