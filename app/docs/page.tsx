import type { Metadata } from 'next';
import DocsPortal from '@/components/docs/DocsPortal';

export const metadata: Metadata = {
  title: '說明文件 · Seata Saga State Machine Designer',
  description:
    'Apache Seata Saga State Machine Designer 完整圖文說明文件系列：視覺畫布、360° Catch 動態錨點、多層語意自動排版、MiniMax AI 排版、雙欄行號閃爍、YAML 註解保留、多檔父子匯入、多層 SubStateMachine 鑽取、補償模擬與 VS Code 擴充套件指南。',
};

export default function DocsPage() {
  return <DocsPortal />;
}
