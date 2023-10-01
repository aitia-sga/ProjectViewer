
import * as vscode from 'vscode';
import * as fs from 'fs';

export type File = {
	fileName: string;
	absolutPath: string;
	logicalPath: string;
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
			vscode.window.showInformationMessage(`A project called ${projectName} already exists!`);

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

	createNewFolder (proj: Project, newDirectory: string):void  {

		if(this.directoryExists(proj, newDirectory)) 
			vscode.window.showInformationMessage(`A directory called ${newDirectory} already exists!`);
		
		else {

			const newDir: Directory = {
				name: newDirectory,
				files: []
			};

			proj.directorys.push(newDir);
			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
			// this.jsonData.projects.

		}

		// const projectIndex = this.jsonData.projects.find
		// const projectIndex = proj.directorys.find(directory => directory.name === newDirectory)


		
		// const projectIndexIndex = proj.directorys.indexOf(newDirectory) 
	}

	// const createNewLogicalFolder2 = async(): void => {

	// }

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
			vscode.window.showInformationMessage(`Adding ${fileName} to project`);
		}
	}

	removeFileFromProject(removedFile: File): void {
		const removedFilePath = removedFile.logicalPath.split("/");
        if(removedFilePath.length < 2) { vscode.window.showErrorMessage("Wrong logical path!"); return; }

		const directoryPath = this.jsonData.projects.find(project => project.name === removedFilePath[0])?.directorys.find(directory => directory.name === removedFilePath[1]);
		if(!directoryPath) {vscode.window.showErrorMessage("Wrong logical path!"); return; }

		const foundedRemovedFile = directoryPath.files.find(file => file.fileName === removedFile.fileName);
		if(!foundedRemovedFile) {vscode.window.showErrorMessage("Wrong filename!"); return; }

		const projectIndex = directoryPath.files.indexOf(foundedRemovedFile);

		if(projectIndex !== -1) {
			directoryPath.files.splice(projectIndex, 1);
			fs.writeFileSync(this.jsonPath, JSON.stringify(this.jsonData, null, 4), 'utf-8');
			vscode.window.showInformationMessage(`Removing ${removedFile.fileName} from project`);
		}

	}
}

