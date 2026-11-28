# Omni Cash Transaction Saga Examples

本目錄包含一組真實業務場景的 Apache Seata Saga 狀態機 YAML 定義（1 個父狀態機 + 2 個子狀態機），適用於測試**多檔父子批次匯入**、**SubStateMachine 巢狀鑽取**、**360° Catch 錨點與多邊繞道**以及**五層語意自動排版 / MiniMax AI 排版**。

## 檔案清單

| 檔案 | 角色 | `Name` | 規模與特色 |
| --- | --- | --- | --- |
| [`omni_cash_transaction.saga.yaml`](./omni_cash_transaction.saga.yaml) | 父狀態機（Root） | `omni_cash_transaction` | 以 `Choice` 依交易類型分派至存款或沖正兩個 `SubStateMachine` 子狀態機，並包含全域 `Catch` 異常處理 |
| [`repayment_cash_deposit.saga.yaml`](./repayment_cash_deposit.saga.yaml) | 子狀態機（存款） | `repayment_cash_deposit` | 現金還款存款主流程、補償任務（`CompensateState`）與多分支結果判定 |
| [`repayment_cash_cancellation.saga.yaml`](./repayment_cash_cancellation.saga.yaml) | 子狀態機（沖正） | `repayment_cash_cancellation` | 27 節點、44 條連線的大型複雜拓樸，涵蓋多段主流程、並行 Catch 彙整與補償鏈，適合作為自動排版壓測基準 |

## 在設計器中快速載入

1. 於設計器工作列點擊 **匯入**，一次選取本目錄全部 3 個 `.saga.yaml` 檔案。
2. 系統會透過 `lib/saga/batchImport.ts` 自動解析 `StateMachineName` 依賴關係，將 `omni_cash_transaction` 設為主畫布並註冊兩個子狀態機。
3. 雙擊 `SubStateMachine` 節點即可直接鑽取檢視子狀態機，或點擊工作列 **自動排版 ▾** 切換「橫向泳道（預設）」、「緊湊總覽」與「縱向流程」三種排版策略。
