const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateKey(input: number | Date): string {
	const date = typeof input === "number" ? new Date(input) : input;
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
	const [year, month, day] = dateKey.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

export function startOfDay(input: number | Date): Date {
	const date = new Date(input);
	date.setHours(0, 0, 0, 0);
	return date;
}

function endOfDay(input: number | Date): Date {
	const date = new Date(input);
	date.setHours(23, 59, 59, 999);
	return date;
}

export function addDays(input: Date, days: number): Date {
	return new Date(input.getTime() + days * DAY_MS);
}

export function eachDay(start: Date, end: Date): Date[] {
	const days: Date[] = [];
	const current = startOfDay(start);
	const final = startOfDay(end);

	while (current.getTime() <= final.getTime()) {
		days.push(new Date(current));
		current.setDate(current.getDate() + 1);
	}

	return days;
}

export function startOfWeek(input: number | Date): Date {
	const date = startOfDay(input);
	const day = date.getDay();
	const delta = day === 0 ? -6 : 1 - day;
	date.setDate(date.getDate() + delta);
	return date;
}

export function startOfMonth(input: number | Date): Date {
	const date = startOfDay(input);
	date.setDate(1);
	return date;
}

export function endOfMonth(input: number | Date): Date {
	const date = startOfDay(input);
	date.setMonth(date.getMonth() + 1, 0);
	return endOfDay(date);
}

export function formatShortDate(dateKey: string): string {
	return parseDateKey(dateKey).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

export function formatMonthLabel(date: Date): string {
	return date.toLocaleDateString(undefined, {
		month: "short",
		year: "numeric",
	});
}
