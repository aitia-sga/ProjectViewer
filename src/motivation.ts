
export class Motivation {
	static motivations: string[] = [
		'You are the best!',
		'You can do it!',
		'I trust you!',
		'You will succeed!',
		'You are very good!'
	];

	static needMotivation(): string {
		const motivationId = Math.floor(Math.random() * this.motivations.length);
		return this.motivations[motivationId];
	}
}
