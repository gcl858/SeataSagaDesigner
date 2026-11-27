# 08. Seata STATE_LANG 規格參考與常見問題

> Apache Seata Saga STATE_LANG JSON / YAML 核心欄位總表、Input/Output 參數表達式語法速查，以及匯入、註解保留與 VS Code 部署常見問題解答。

**分類**：規格參考 · **閱讀時間**：5 分鐘閱讀

## 狀態機頂層與任務欄位規格總表

以下整理本設計器完整支援並可雙向序列化至 JSON 與 YAML 的 Apache Seata Saga 核心屬性：

| 欄位名稱 | 層級 | 型別 | 說明 |
| --- | --- | --- | --- |
| Name | 頂層 | string | 狀態機全域唯一識別名稱，亦作為 SubStateMachine 呼叫時的參照鍵。 |
| StartState | 頂層 | string | 流程啟動後第一個執行的 State 名稱。 |
| Version | 頂層 | string | 狀態機語意版本號（例如 0.0.1 或 1.2.0）。 |
| Type | 頂層 | string | 固定為 STATE_LANG，代表 Apache Seata 狀態語言規範。 |
| Persist | 頂層 | boolean | 是否將狀態機執行與補償日誌持久化至 Seata Server 資料庫。 |
| ServiceName / ServiceMethod | ServiceTask | string | 目標 SpringBean、Dubbo 或 SofaRPC 服務名稱與方法簽章。 |
| CompensateState | Task / SubMachine | string | 對應補償狀態名稱，該目標節點須設定 IsForCompensation: true。 |
| Input / Output | Task / SubMachine | array / object | 從上下文提取參數（$.[key]）與寫回執行結果（$.#root）的映射規則。 |
| Status | ServiceTask | object | 依據回傳值或例外動態判定 SU（成功）、FA（失敗）或 UN（未知）。 |
| Catch / Retry | Task / SubMachine | array | 定義例外類別捕獲轉移目標（Next）與指數退避重試策略（IntervalSeconds、MaxAttempts、BackoffRate）。 |

## Input / Output 與 Choice 表達式速查

在 Seata Saga 與本設計器的內建模擬器中，常用的上下文取值與條件判斷語法如下：

**常用參數映射與條件判斷語法**

```yaml
# Input：從流程上下文（Context）擷取欄位傳入服務方法
Input:
  - "$.[businessKey]"
  - "$.[amount]"

# Output：將服務回傳值（#root）寫回流程上下文指定變數
Output:
  reduceInventoryResult: "$.#root"

# Choice Expression：於條件閘道評估上下文布林或數值比較
Choices:
  - Expression: "[reduceInventoryResult] == true"
    Next: ReduceBalance
  - Expression: "[riskScore] < 80"
    Next: PaymentSubMachine
Default: Fail
```

## 常見問題排除（FAQ）

以下彙整團隊在設計流程、維護 YAML 註解與使用 VS Code Web Extension 時最常遇到的問題與建議解法：

| 常見問題 | 解決方式 |
| --- | --- |
| 匯入舊版純 JSON 檔案沒有 style.bounds 座標，節點全部重疊怎麼辦？ | 載入無座標 JSON/YAML 時系統會自動套用拓樸排版；您也可隨時點擊工作列「自動排版」重新整理主流程與補償節點位置。 |
| 為什麼某些編輯操作後想確認 YAML 註解是否仍完整保留？ | 只要原始檔以 YAML 格式匯入或套用，系統就會保存 AST 範本；切換至「雙欄同步」並選擇 YAML 即可即時檢視所有表頭、行內與區塊 # 註解。 |
| 在雙擊 SubStateMachine 時跳出循環參考提示是什麼意思？ | 代表該節點的 StateMachineName 直接或間接指向了目前呼叫鏈中的父狀態機，為避免無限遞迴系統已自動阻斷，請修改 StateMachineName 指向正確子流程。 |
| 在 vscode.dev 載入 Web Extension 時無法連線設計器怎麼辦？ | 請確認 VS Code 設定 seataSaga.designerUrl 為有效的 HTTPS 位址（本機測試可使用 http://localhost:3000），且該部署網址允許被瀏覽器 iframe 內嵌。 |
