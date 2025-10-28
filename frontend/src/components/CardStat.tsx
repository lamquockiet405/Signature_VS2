interface CardStatProps {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
}

export default function CardStat({
  title,
  value,
  change,
  isPositive,
}: CardStatProps) {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <p className="text-sm text-gray-500 mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <h3 className="text-3xl font-bold text-gray-900">
          {typeof value === "number" ? value.toLocaleString() : value}
        </h3>
        <span
          className={`text-sm font-medium ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {isPositive ? "+" : ""}
          {change}
        </span>
      </div>
    </div>
  );
}
