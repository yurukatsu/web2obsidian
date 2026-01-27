/**
 * Format date in various formats
 */
export function formatDate(
  date: Date,
  format: "date" | "time" | "datetime" | "year" | "month" | "day"
): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  switch (format) {
    case "date":
      return `${year}-${month}-${day}`;
    case "time":
      return `${hours}:${minutes}`;
    case "datetime":
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    case "year":
      return year.toString();
    case "month":
      return month;
    case "day":
      return day;
    default:
      return "";
  }
}
