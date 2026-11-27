# Apache Seata Saga State Machine Designer 完整使用與架構說明文件

本系列文件涵蓋視覺化設計器、雙欄行號閃爍同步、YAML `#` 註解保留、多層 `SubStateMachine` 巢狀鑽取、分散式事務補償模擬與 VS Code 瀏覽器／桌面版擴充套件的完整圖文操作指南。

## 文件目錄

- [01. 總覽與快速入門指南](./01-getting-started.md) — 認識 Apache Seata Saga State Machine Designer 的完整工作區架構、內建官方範例與 3 分鐘建立第一個分散式事務狀態機的操作流程。
- [02. 視覺化畫布與 Seata 狀態節點指南](./02-canvas-and-states.md) — 深入了解 8 種 Apache Seata 官方狀態節點、4 種流程與補償連線語意、節點快速工具列，以及左右可收合邊緣鉗鈕的高效畫布操作技巧。
- [03. 雙欄同步與行號閃爍定位](./03-split-view-sync.md) — 同時開啟視覺化畫布與 JSON/YAML 程式碼面板，體驗點選節點或連線時自動捲動至精確行號並以特效閃爍標示區塊的流暢工作流。
- [04. YAML 匯入匯出與 # 註解保留技術](./04-yaml-comments.md) — 了解設計器如何透過 YAML v2 AST 樹狀結構對齊機制，在視覺化拖曳、屬性修改與節點重命名過程中完整保留所有 # 註解說明。
- [05. 多層 SubStateMachine 巢狀子狀態機鑽取](./05-sub-state-machine.md) — 透過內建三層巢狀範例（訂單履約 → 支付結算 → 反詐欺驗證），掌握雙擊進入子狀態機、麵包屑返回父層、循環參考防護與獨立復原歷史的完整機制。
- [06. 拓樸驗證與分散式事務補償模擬](./06-validation-and-simulation.md) — 使用即時 Seata 規範診斷抽屜與互動式執行模擬器，在部署至正式微服務叢集前完整演練成功提交、異常捕獲（Catch）與 LIFO 反向補償流程。
- [07. VS Code 瀏覽器版與桌面版擴充套件整合](./07-vscode-extension.md) — 一鍵下載免編譯、零 Node.js 依賴的通用 VS Code Web Extension，直接在 vscode.dev、github.dev、Codespaces 與桌面版 VS Code 中視覺化編輯 Saga 檔案。
- [08. Seata STATE_LANG 規格參考與常見問題](./08-schema-and-faq.md) — Apache Seata Saga STATE_LANG JSON / YAML 核心欄位總表、Input/Output 參數表達式語法速查，以及匯入、註解保留與 VS Code 部署常見問題解答。
