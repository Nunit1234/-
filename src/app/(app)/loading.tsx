export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-pulse">
      <div className="h-7 w-44 bg-green-100 rounded mb-5" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-white rounded-xl shadow" />
        ))}
      </div>
      <div className="h-72 bg-white rounded-xl shadow" />
    </div>
  );
}
