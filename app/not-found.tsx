import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-6">
      <div className="max-w-md w-full text-center space-y-5">
        <p className="font-mono tabular-nums text-xs font-semibold text-blue-700 dark:text-blue-400">
          404
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          找不到此頁面 · Page Not Found
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          您造訪的路由不存在或已移動，請返回視覺化設計器或檢視完整說明文件。
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
          >
            返回設計器
          </Link>
          <Link
            href="/docs"
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            說明文件
          </Link>
        </div>
      </div>
    </main>
  );
}
