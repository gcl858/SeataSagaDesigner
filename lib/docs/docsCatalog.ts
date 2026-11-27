import { Locale } from '@/lib/saga/i18n';
import { buildZipArchive, ZipEntryInput } from '@/lib/saga/zipBuilder';

export type ArchitectureDiagramId =
  | 'saga-lifecycle'
  | 'yaml-ast-pipeline'
  | 'submachine-stack'
  | 'vscode-bridge';

export interface DocFigure {
  src: string;
  alt: string;
  caption: string;
  annotations?: Array<{ label: string; detail: string }>;
}

export interface DocTable {
  headers: string[];
  rows: string[][];
}

export interface DocCodeBlock {
  language: string;
  title?: string;
  code: string;
}

export interface DocCallout {
  kind: 'info' | 'tip' | 'warning';
  title: string;
  body: string;
}

export interface DocSection {
  id: string;
  heading: string;
  paragraphs: string[];
  steps?: string[];
  figures?: DocFigure[];
  diagram?: {
    id: ArchitectureDiagramId;
    title: string;
    caption: string;
  };
  table?: DocTable;
  codeBlock?: DocCodeBlock;
  callout?: DocCallout;
}

export interface DocChapter {
  index: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  readTime: string;
  keywords: string[];
  sections: DocSection[];
}

const CHAPTERS_ZH: DocChapter[] = [
  {
    index: '01',
    slug: '01-getting-started',
    category: '快速入門',
    title: '總覽與快速入門指南',
    summary:
      '認識 Apache Seata Saga State Machine Designer 的完整工作區架構、內建官方範例與 3 分鐘建立第一個分散式事務狀態機的操作流程。',
    readTime: '4 分鐘閱讀',
    keywords: ['快速入門', '介面導覽', '快捷鍵', 'Seata Saga', '範本', '深色模式'],
    sections: [
      {
        id: 'workspace-anatomy',
        heading: '工作區介面導覽',
        paragraphs: [
          'Seata Saga State Machine Designer 採用高效率的四區域桌面工程版面，將視覺化流程設計、屬性檢查、JSON/YAML 雙向編輯、執行補償模擬與 VS Code 擴充整合集中在單一工作區中。',
          '開啟應用程式後，系統會自動載入 Apache Seata 官方經典範例 reduceInventoryAndBalance（庫存與餘額扣減），讓您立即體驗完整的正向流程、條件分支與例外補償拓樸。',
        ],
        figures: [
          {
            src: '/docs/images/01-overview-canvas.png',
            alt: 'Seata Saga State Machine Designer 完整工作區總覽截圖',
            caption:
              '圖 1-1：主工作區介面總覽，包含頂部檢視切換列、工作列、左側狀態節點庫、中央互動畫布與右側屬性檢查器。',
            annotations: [
              {
                label: '頂部導覽列',
                detail:
                  '切換「畫布設計」、「雙欄同步」、「JSON / YAML」、「執行模擬」與「說明文件」，右側提供一鍵「匯出 JSON」。',
              },
              {
                label: '工作列',
                detail:
                  '切換內建範本、檢視目前狀態機名稱與節點數，執行復原/重做、自動排版、匯入/匯出 YAML 與 SVG、結構驗證、開啟 VS Code 擴充整合，以及切換語系（繁中/EN）與深淺色主題。',
              },
              {
                label: '左側節點庫與邊緣鉗鈕',
                detail:
                  '提供 4 種畫布操作模式與 8 種官方 Seata 狀態節點，支援點擊加入或拖曳至畫布任意座標，並可透過邊緣鉗鈕一鍵收合。',
              },
              {
                label: '右側屬性檢查器',
                detail:
                  '未選取節點時顯示狀態機全域設定（Name、Version、Persist 等）；點選節點或連線時即時切換為對應屬性表單。',
              },
            ],
          },
        ],
      },
      {
        id: 'three-step-quickstart',
        heading: '三步驟建立第一個 Saga 狀態機',
        paragraphs: [
          '無論是從零開始建立新流程，或改寫既有的微服務分散式事務定義，都可依照以下三個步驟快速完成並驗證：',
        ],
        steps: [
          '選擇起始範本：在工作列「範本」下拉選單中，選擇「庫存與餘額扣減」、「訂單履約與子狀態機（多層範例）」或「空白起始範本」。',
          '視覺化編排流程：從左側節點庫拖曳 ServiceTask、Choice、ScriptTask 或 SubStateMachine 至畫布，拖曳節點右側藍色連接點建立 Next / Choice / Catch / CompensateState 連線，並在右側面板填寫 ServiceName、ServiceMethod 與 Input/Output 參數。',
          '驗證、模擬並匯出：點擊工作列「驗證」確認 0 錯誤，切換至「執行模擬」測試失敗與補償回滾路徑，最後匯出為保留完整座標與註解的 YAML 或 JSON 定義檔。',
        ],
      },
      {
        id: 'shortcuts-and-preferences',
        heading: '常用鍵盤快捷鍵與偏好設定',
        paragraphs: [
          '設計器內建與桌面工程工具一致的鍵盤快捷鍵，在非文字輸入狀態下皆可直接觸發：',
        ],
        table: {
          headers: ['快捷鍵 / 控制項', '功能說明', '適用範圍'],
          rows: [
            ['Ctrl + Z / Cmd + Z', '復原上一步畫布或屬性變更（每個子狀態機獨立維護歷史）', '畫布與雙欄模式'],
            ['Ctrl + Y / Shift + Ctrl + Z', '重做已復原的變更', '畫布與雙欄模式'],
            ['Alt + ←', '從 SubStateMachine 子狀態機快速返回上一層父狀態機', '巢狀子狀態機檢視'],
            ['Escape', '取消目前連線模式或關閉開啟中的彈窗', '全域'],
            ['滑鼠滾輪 / 空白拖曳畫布', '平滑縮放畫布（40%–200%）與平移視野，左下角提供適應畫面與重設縮放', '畫布區域'],
          ],
        },
      },
    ],
  },
  {
    index: '02',
    slug: '02-canvas-and-states',
    category: '視覺化設計',
    title: '視覺化畫布與 Seata 狀態節點指南',
    summary:
      '深入了解 8 種 Apache Seata 官方狀態節點、4 種流程與補償連線語意、節點快速工具列，以及左右可收合邊緣鉗鈕的高效畫布操作技巧。',
    readTime: '6 分鐘閱讀',
    keywords: ['ServiceTask', 'ScriptTask', 'Choice', 'SubStateMachine', 'CompensationTrigger', '邊緣鉗鈕', '自動排版'],
    sections: [
      {
        id: 'interactive-canvas',
        heading: '互動畫布、快速工具列與可收合左右邊緣鉗鈕',
        paragraphs: [
          '點選畫布上任意狀態節點後，節點右側會出現懸浮式快速操作列，無須切換游標模式即可一鍵延伸下一個 ServiceTask、Choice 分支、綁定補償任務（CompensateState）、接續 Succeed 終點或刪除節點。',
          '當流程圖較寬或在筆電螢幕上作業時，點擊左側節點庫右緣與右側面板左緣的「邊緣鉗鈕」，即可平滑隱藏側欄，將 100% 寬度釋放給中央畫布。',
        ],
        figures: [
          {
            src: '/docs/images/02-canvas-node-selected.png',
            alt: '畫布節點選取狀態、快速延伸工具列與右側屬性編輯面板截圖',
            caption:
              '圖 2-1：點選 ReduceInventory 節點後，顯示懸浮快速操作列、右側 ServiceTask 完整屬性（SpringBean、參數型別、補償任務與 Status Mapping）以及左右面板邊緣鉗鈕。',
          },
        ],
      },
      {
        id: 'eight-state-types',
        heading: '8 種官方 Seata Saga 狀態節點完整對照',
        paragraphs: [
          '設計器完整對齊 Apache Seata STATE_LANG 規範，支援全部 8 類節點與其專屬視覺辨識樣式：',
        ],
        table: {
          headers: ['節點類型', '中文名稱', '核心用途與關鍵屬性'],
          rows: [
            ['StartState', '起始事件', '標示整個狀態機的進入點，對應頂層 StartState 屬性；每個狀態機僅允許一個起始節點。'],
            ['ServiceTask', '微服務任務', '呼叫遠端或本地微服務（SpringBean / Dubbo / SofaRPC），支援 CompensateState、Input/Output、Status Mapping、Retry 與 Catch。'],
            ['ScriptTask', '內嵌腳本', '執行 Groovy 等內嵌運算腳本（ScriptType、ScriptContent），常用於風控評分、規則計算或資料轉換。'],
            ['Choice', '條件閘道', '依 SpEL 條件運算式（Choices[]）將流程導向不同分支，並支援 Default 預設路徑。'],
            ['SubStateMachine', '子狀態機', '以 StateMachineName 委派呼叫另一組獨立 Saga 狀態機；支援畫布雙擊直接鑽取編輯與跨層補償。'],
            ['CompensationTrigger', '觸發補償', '接收失敗或例外路徑後，通知 Seata 引擎以 LIFO（後進先出）順序反向補償所有已成功的任務。'],
            ['Succeed', '成功終止', '標記分散式事務順利完成並提交結束狀態。'],
            ['Fail', '失敗終止', '標記流程異常終止，可設定 ErrorCode 與 Message 供上游系統識別。'],
          ],
        },
      },
      {
        id: 'four-edge-types',
        heading: '4 種連線語意與自動拓樸排版',
        paragraphs: [
          '畫布底部圖例清楚區分流程中的 4 種連線語意：實線灰藍箭頭代表一般順序轉移（Next）或條件分支（Choice / Default）；紫色虛線代表補償綁定（CompensateState）；橘色點線代表例外捕獲（Catch）。',
          '若手動拖曳後連線交錯，隨時點擊工作列「自動排版」按鈕，演算法會依據拓樸層級自動排列主流程，並將所有 IsForCompensation 補償節點整齊對齊於其對應正向任務正下方。',
        ],
        callout: {
          kind: 'tip',
          title: '快速建立補償任務的小技巧',
          body: '選取任何 ServiceTask 後，直接點擊節點右側懸浮工具列的「紫色回轉箭頭」圖示，設計器會自動在正下方建立已勾選 IsForCompensation 的補償 ServiceTask 並完成 CompensateState 連線綁定。',
        },
      },
    ],
  },
  {
    index: '03',
    slug: '03-split-view-sync',
    category: '雙欄同步',
    title: '雙欄同步與行號閃爍定位',
    summary:
      '同時開啟視覺化畫布與 JSON/YAML 程式碼面板，體驗點選節點或連線時自動捲動至精確行號並以特效閃爍標示區塊的流暢工作流。',
    readTime: '4 分鐘閱讀',
    keywords: ['雙欄同步', 'Split View', '行號定位', '閃爍高亮', 'JSON', 'YAML'],
    sections: [
      {
        id: 'click-to-flash',
        heading: '點選畫布即時定位與區塊閃爍特效',
        paragraphs: [
          '切換至頂部導覽列的「雙欄同步」後，右側面板會展開具備同步行號列（Line Gutter）的程式碼編輯器，支援在 JSON 與 YAML 之間隨時切換。',
          '當您在左側畫布點擊任何狀態節點（例如 ReduceBalance）或任一條轉移／補償／例外連線時，底層的 Source Locator 會精確計算該元素在目前原始碼中的起始與結束行號，在 240 毫秒內平滑捲動至視窗中央，並以藍色光暈區塊閃爍提示，同時於頂部列顯示精確範圍標籤（例如 ReduceBalance · L59-88）。',
        ],
        figures: [
          {
            src: '/docs/images/03-split-view-flash.png',
            alt: '雙欄同步模式點擊 ReduceBalance 節點並自動捲動至 YAML L59-88 行閃爍高亮截圖',
            caption:
              '圖 3-1：雙欄同步模式下點擊畫布中的 ReduceBalance 節點，右側 YAML 面板自動跳轉至 L59-88 行並觸發藍色區塊閃爍高亮。',
          },
        ],
      },
      {
        id: 'bidirectional-editing',
        heading: '雙向同步與 style.bounds 座標控制',
        paragraphs: [
          '在畫布上拖曳節點、修改屬性或連線時，右側 JSON/YAML 會即時反映最新結構；反之，當您直接在右側編輯器修改原始碼時，「套用變更至畫布」按鈕會亮起，點擊後即可即時解析並重繪畫布。',
          '頂部的「包含畫布座標 (style)」核取方塊可控制輸出是否保留每個節點的 style.bounds（x、y、width、height）資訊：開發設計期建議保持勾選以保留排版，部署至極簡執行環境時可取消勾選以產出純語意定義檔。',
        ],
        callout: {
          kind: 'info',
          title: '支援點選連線定位特定欄位',
          body: '不僅是節點，點擊畫布上的 Choice 條件標籤、Compensate 紫色虛線或 Throwable 橘色例外線時，右側程式碼會直接跳轉並高亮對應的 Choices、CompensateState 或 Catch 區段行號。',
        },
      },
    ],
  },
  {
    index: '04',
    slug: '04-yaml-comments',
    category: 'YAML 工程化',
    title: 'YAML 匯入匯出與 # 註解保留技術',
    summary:
      '了解設計器如何透過 YAML v2 AST 樹狀結構對齊機制，在視覺化拖曳、屬性修改與節點重命名過程中完整保留所有 # 註解說明。',
    readTime: '5 分鐘閱讀',
    keywords: ['YAML', '註解保留', 'AST', '匯入', '匯出', '格式化'],
    sections: [
      {
        id: 'comment-preservation-demo',
        heading: '匯入、編輯並完整保留所有 # 註解',
        paragraphs: [
          '實務上團隊經常在 Seata Saga YAML 設定檔中撰寫豐富的業務說明、風控門檻理由與維運聯絡註解。傳統「JSON.parse → YAML.stringify」流程會無條件丟棄所有 # 註解，導致視覺化工具難以融入 Git 團隊協作。',
          '本設計器採用基於 AST（抽象語法樹）的無損調和演算法：無論是檔案表頭註解、區塊前註解（commentBefore）、行尾註解（inline # comment）、陣列項目註解或檔尾註解，在畫布進行節點拖曳、連線調整或重新命名後重新匯出 YAML 時，全部都會精準保留於對應位置。',
        ],
        figures: [
          {
            src: '/docs/images/04-yaml-comments-editor.png',
            alt: 'YAML 編輯器中完整保留表頭註解、行尾註解與節點區塊註解的截圖',
            caption:
              '圖 4-1：於 JSON/YAML 檢視中匯入含表頭註解、StartState 行尾註解與 ReduceInventory 區塊註解的 YAML，點擊「套用變更至畫布」後註解結構完全保留。',
          },
        ],
      },
      {
        id: 'ast-pipeline-diagram',
        heading: 'YAML AST 註解保留調和管線原理',
        paragraphs: [
          '每次匯入或套用 YAML 時，系統除了將其轉換為視覺化圖形模型（SagaGraph）外，還會將原始 YAML 文本快照保存為 yamlTemplate。當使用者在畫布上修改節點或重新命名狀態時，序列化器會重新解析 yamlTemplate 的 Document AST，僅針對實際變動的鍵值進行就地更新或鍵名遷移，從而完整守住每一個註解節點與原本的屬性順序。',
        ],
        diagram: {
          id: 'yaml-ast-pipeline',
          title: 'YAML v2 AST 註解無損調和管線',
          caption:
            '架構圖 4-1：YAML 原始碼同時建立視覺圖形與 AST 註解範本，經畫布編輯與重命名調和後輸出無損註解的 .saga.yaml。',
        },
      },
      {
        id: 'yaml-example',
        heading: '支援註解保留的 Seata Saga YAML 範例',
        paragraphs: [
          '您可以直接複製以下含完整註解的 YAML 範例貼入「JSON / YAML」檢視，或存檔為 .saga.yaml 透過工作列「匯入 JSON/YAML」載入測試：',
        ],
        codeBlock: {
          language: 'yaml',
          title: 'orderInventory.saga.yaml',
          code: `# Apache Seata Saga 庫存與餘額扣減流程
# 團隊規範：所有正向 ServiceTask 均需綁定 CompensateState
Name: reduceInventoryAndBalance
Comment: Reduce inventory then reduce balance
StartState: ReduceInventory # 流程起始節點
Version: 1.0.0
Type: STATE_LANG
Persist: true
States:
  # 步驟 1：扣減商品庫存（失敗時由 CompensateReduceInventory 回補）
  ReduceInventory:
    Type: ServiceTask
    ServiceName: inventoryAction
    ServiceMethod: reduce
    ServiceType: SpringBean
    CompensateState: CompensateReduceInventory # 綁定補償節點
    Input:
      - $. [businessKey] # 訂單唯一業務鍵
      - $. [count]       # 購買數量
    Next: Succeed`,
        },
      },
    ],
  },
  {
    index: '05',
    slug: '05-sub-state-machine',
    category: '進階巢狀流程',
    title: '多層 SubStateMachine 巢狀子狀態機鑽取',
    summary:
      '透過內建三層巢狀範例（訂單履約 → 支付結算 → 反詐欺驗證），掌握雙擊進入子狀態機、麵包屑返回父層、循環參考防護與獨立復原歷史的完整機制。',
    readTime: '6 分鐘閱讀',
    keywords: ['SubStateMachine', '子狀態機', '雙擊鑽取', '返回父狀態機', '麵包屑', '循環防護'],
    sections: [
      {
        id: 'parent-drilldown',
        heading: '雙擊 SubStateMachine 節點直接進入子狀態機',
        paragraphs: [
          '大型分散式事務往往需要模組化拆分。請在工作列「範本」切換至「訂單履約與子狀態機（多層範例）」，您會在主流程 orderFulfillmentSaga 中看到天藍色雙層卡片樣式的 PaymentSubMachine（SubStateMachine）節點。',
          '只要在畫布上「雙擊」PaymentSubMachine 節點，或是點選該節點後點擊右側屬性面板中的「進入子狀態機」按鈕（亦可使用節點快速工具列最上方的資料夾圖示），畫布就會立即切換並載入對應的 paymentSettlementSubSaga 子狀態機。',
        ],
        figures: [
          {
            src: '/docs/images/05-submachine-parent.png',
            alt: 'orderFulfillmentSaga 父狀態機中選取 PaymentSubMachine 子狀態機節點的截圖',
            caption:
              '圖 5-1：在頂層 orderFulfillmentSaga 選取 PaymentSubMachine 節點，右側面板即時顯示已連結工作區子狀態機（9 節點）與「進入子狀態機」入口。',
          },
        ],
      },
      {
        id: 'breadcrumb-return',
        heading: '多層導覽麵包屑與返回父狀態機機制',
        paragraphs: [
          '進入子狀態機後，工作列下方會自動浮現清晰的層級導覽列（Breadcrumb），顯示完整呼叫路徑（例如 orderFulfillmentSaga > paymentSettlementSubSaga (PaymentSubMachine)）與目前深度（層級 2）。',
          '在 Level 2 的 paymentSettlementSubSaga 中還包含第三層子狀態機節點 FraudSubCheck（指向 fraudVerificationSubSaga），支援繼續雙擊深入至層級 3。隨時點擊左側「返回父狀態機」按鈕、點擊麵包屑中的任意父層名稱，或按下快捷鍵 Alt + ←，皆可瞬間返回父狀態機並自動選取原本進入的 SubStateMachine 節點，確保上下文不遺失。',
        ],
        figures: [
          {
            src: '/docs/images/05-submachine-level2.png',
            alt: '雙擊進入 paymentSettlementSubSaga 子狀態機後顯示返回父狀態機麵包屑與第三層 FraudSubCheck 的截圖',
            caption:
              '圖 5-2：已進入層級 2 的 paymentSettlementSubSaga，頂部提供「返回父狀態機」按鈕與層級麵包屑，畫布內可繼續雙擊 FraudSubCheck 進入層級 3 反詐欺驗證流程。',
          },
        ],
      },
      {
        id: 'submachine-architecture',
        heading: '三層狀態機呼叫堆疊與安全防護設計',
        paragraphs: [
          '為了在真實企業場景中確保多層編排安全可靠，工作區管理引擎（subMachines）實作了四項核心保障：',
        ],
        diagram: {
          id: 'submachine-stack',
          title: '三層 SubStateMachine 呼叫堆疊與防護機制',
          caption:
            '架構圖 5-1：orderFulfillmentSaga → paymentSettlementSubSaga → fraudVerificationSubSaga 三層呼叫鏈、獨立復原歷史與循環參考防護。',
        },
        steps: [
          '自動鷹架建立（Auto-Scaffolding）：若雙擊一個尚未定義對應子流程的 SubStateMachine，系統會自動建立含起始點、主服務任務、補償任務與 Succeed 終點的標準子狀態機，無須手動從頭建檔。',
          '循環參考偵測與阻斷：無論是自我呼叫（A → A）或跨層環狀參考（A → B → A），系統都會在雙擊進入與結構驗證階段即時阻斷並發出錯誤提示。',
          '每層獨立 Undo / Redo 歷史：在子狀態機按 Ctrl+Z 只會復原子狀態機本身的編輯，絕不誤刪父狀態機節點。',
          '子狀態機更名連動：在子狀態機修改全域 Name 後，返回父層時其對應節點的 StateMachineName 會自動同步更新。',
        ],
      },
    ],
  },
  {
    index: '06',
    slug: '06-validation-and-simulation',
    category: '驗證與模擬',
    title: '拓樸驗證與分散式事務補償模擬',
    summary:
      '使用即時 Seata 規範診斷抽屜與互動式執行模擬器，在部署至正式微服務叢集前完整演練成功提交、異常捕獲（Catch）與 LIFO 反向補償流程。',
    readTime: '5 分鐘閱讀',
    keywords: ['驗證', 'Validation', '模擬器', 'LIFO 補償', 'CompensationTrigger', 'Catch', '單步前進'],
    sections: [
      {
        id: 'lifo-simulation',
        heading: '互動式執行模擬與 LIFO 補償鏈演練',
        paragraphs: [
          '切換至頂部「執行模擬」檢視後，您可以自訂初始 JSON 上下文參數（例如 businessKey、count、amount），並為每個 ServiceTask、ScriptTask 與 SubStateMachine 設定模擬回傳結果：SU（成功）、FA（業務失敗）或 Throw Exception（拋出例外）。',
          '例如在 reduceInventoryAndBalance 中將 ReduceBalance 設為 Throw Exception 後點擊「執行完整模擬」，模擬器會完整走訪 Start → ReduceInventory（註冊補償）→ ChoiceState → ReduceBalance（拋出例外）→ Catch → CompensationTrigger → CompensateReduceInventory（LIFO 反向補償）→ Fail，並在畫布上以綠、琥珀、紫、紅高亮即時標示每一步狀態。',
        ],
        figures: [
          {
            src: '/docs/images/06-simulation-compensation.png',
            alt: 'Saga 執行模擬器模擬 ReduceBalance 拋出例外並觸發補償軌跡的截圖',
            caption:
              '圖 6-1：將 ReduceBalance 設為 Throw Exception 執行完整模擬後，畫布即時著色顯示執行與捕獲路徑，右側完整列出逐步執行與補償軌跡（COMPENSATED）。',
          },
        ],
      },
      {
        id: 'saga-lifecycle-diagram',
        heading: 'Seata Saga 正向執行與 LIFO 反向補償生命週期',
        paragraphs: [
          '模擬器亦支援「單步前進」逐一檢視每一個節點執行前後的 Context 變數變化，並且針對多層 SubStateMachine 提供遞迴子流程模擬，在執行軌跡中清楚顯示跨層的執行與補償步驟。',
        ],
        diagram: {
          id: 'saga-lifecycle',
          title: 'Seata Saga 正向推進與 LIFO 補償執行流程',
          caption:
            '架構圖 6-1：正向任務每成功一步即推入補償堆疊；當後續任務拋出例外經 Catch 導向 CompensationTrigger 時，引擎依後進先出順序依序執行補償任務。',
        },
      },
      {
        id: 'validation-drawer',
        heading: '即時語法與結構診斷抽屜',
        paragraphs: [
          '點擊工作列上的「驗證 (錯誤數/警告數)」按鈕，畫布下方會展開即時診斷清單。點擊清單中任一錯誤或警告項目，系統會自動選取並聚焦於問題節點或連線，協助快速修正。',
        ],
        figures: [
          {
            src: '/docs/images/06-validation-drawer.png',
            alt: '畫布底部展開狀態機語法與結構驗證抽屜顯示零錯誤通過狀態的截圖',
            caption:
              '圖 6-2：驗證抽屜即時檢核狀態機拓樸完整性，零錯誤與警告時顯示綠色通過提示。',
          },
        ],
        table: {
          headers: ['診斷代碼', '嚴重程度', '檢核條件說明'],
          rows: [
            ['NO_START_STATE', 'Error', '狀態機缺少 StartState 起始節點，或 StartState 尚未連接至第一個任務。'],
            ['MISSING_SERVICE_META', 'Error', 'ServiceTask 缺少必填的 ServiceName 或 ServiceMethod 欄位。'],
            ['EMPTY_SCRIPT', 'Error', 'ScriptTask 缺少可執行的 ScriptContent 腳本內容。'],
            ['SUBMACHINE_SELF_CYCLE', 'Error', 'SubStateMachine 的 StateMachineName 指向目前狀態機本身形成無限遞迴。'],
            ['UNRESOLVED_SUBMACHINE', 'Warning', 'SubStateMachine 參考的目標子狀態機尚未在工作區建立定義檔。'],
            ['UNREACHABLE_STATE', 'Warning', '畫布上存在無法由 StartState 到達且非補償用途的孤立節點。'],
          ],
        },
      },
    ],
  },
  {
    index: '07',
    slug: '07-vscode-extension',
    category: 'IDE 擴充整合',
    title: 'VS Code 瀏覽器版與桌面版擴充套件整合',
    summary:
      '一鍵下載免編譯、零 Node.js 依賴的通用 VS Code Web Extension，直接在 vscode.dev、github.dev、Codespaces 與桌面版 VS Code 中視覺化編輯 Saga 檔案。',
    readTime: '6 分鐘閱讀',
    keywords: ['VS Code', 'vscode.dev', 'github.dev', 'Web Extension', 'CustomTextEditorProvider', 'Webview Bridge'],
    sections: [
      {
        id: 'download-and-install',
        heading: '一鍵下載即用型 VS Code Web Extension',
        paragraphs: [
          '點擊工作列右側的「VS Code 擴充」按鈕，即可開啟擴充套件整合視窗。系統會自動帶入目前應用程式的 Hosted Designer URL，並即時打包零 Node.js 依賴的通用擴充套件（seata-saga-vscode-web-extension.zip）。',
          '解壓縮後的套件同時宣告 "browser": "./dist/web/extension.js" 與 "main": "./dist/web/extension.js"，全程採用 vscode.workspace.fs 與 Webview API，無須安裝任何 npm 依賴即可直接在瀏覽器版與桌面版 VS Code 執行。',
        ],
        figures: [
          {
            src: '/docs/images/07-vscode-modal-install.png',
            alt: 'VS Code Web & Desktop 擴充套件整合彈窗顯示 URL 設定、一鍵下載與三種啟動指令的截圖',
            caption:
              '圖 7-1：VS Code 擴充套件整合視窗提供 Hosted URL 設定、預設格式選擇、一鍵下載 .zip 與 3 種免編譯啟動／打包指令。',
          },
        ],
        codeBlock: {
          language: 'bash',
          title: '三種快速啟動與安裝方式',
          code: `# 1. 直接在瀏覽器版 VS Code 測試（免編譯、最快體驗）
npx @vscode/test-web --browserType=chromium --extensionDevelopmentPath=./seata-saga-vscode-web

# 2. 載入至 vscode.dev / github.dev（啟動 CORS 靜態伺服器後於 vscode.dev 按 F1 → Developer: Install Web Extension）
npx serve --cors ./seata-saga-vscode-web

# 3. 打包成 .vsix 安裝至桌面版 VS Code 或發佈至 Visual Studio Marketplace
cd seata-saga-vscode-web && npx @vscode/vsce package --target web && code --install-extension seata-saga-designer-1.0.0.vsix`,
        },
      },
      {
        id: 'live-webview-bridge',
        heading: 'VS Code Webview 實機模擬與雙向通訊協定',
        paragraphs: [
          '在未安裝到 VS Code 之前，您可以直接切換至彈窗的第三個分頁「VS Code Webview 實機模擬」，立即在瀏覽器內體驗完整的 VS Code Host 雙向同步行為：左側模擬 VS Code TextDocument 原始碼、Problems 診斷面板與即時 postMessage 訊號紀錄，右側則以真實 ?embed=vscode 模式掛載本設計器。',
          '當您在右側視覺畫布點擊任意節點（如 PaymentSubMachine）時，上方宿主狀態列會立即顯示 Reveal PaymentSubMachine (L78-98)，代表在真實 VS Code 中已同步將並排文字編輯器捲動並閃爍高亮第 78–98 行。',
        ],
        figures: [
          {
            src: '/docs/images/07-vscode-live-bridge.png',
            alt: 'VS Code Webview 實機模擬分頁顯示 orderFulfillment.saga.yaml、Reveal 行號同步與 postMessage 紀錄的截圖',
            caption:
              '圖 7-2：內建 VS Code Webview 實機模擬介面，展示深色主題同步、窄窗自動收合左側節點庫、即時 Problems 診斷與點擊節點觸發行號定位。',
          },
        ],
      },
      {
        id: 'vscode-bridge-diagram',
        heading: '雙環境 Host Bridge 安全架構與設定項目',
        paragraphs: [
          '擴充套件在 Webview 內強制啟用嚴格 Content-Security-Policy，僅允許 https:// 與 http://localhost 來源載入設計器，並透過明確的 Origin 驗證雙向轉發 postMessage 訊息。於工作區開啟 *.saga.yaml / *.saga.json 時會自動掃描同專案子狀態機，支援原生 Ctrl+S 存檔、Ctrl+Z 復原與 Git Diff 檢視。',
        ],
        diagram: {
          id: 'vscode-bridge',
          title: 'VS Code Web / Desktop 雙環境 Webview Bridge 架構',
          caption:
            '架構圖 7-1：VS Code Extension Host 透過 CustomTextEditorProvider 與 CSP 驗證中繼層，與 Next.js 設計器完成雙向檔案、子狀態機與診斷同步。',
        },
        table: {
          headers: ['VS Code 設定項', '預設值', '功能說明'],
          rows: [
            ['seataSaga.designerUrl', '當前應用程式網址', '指定 Webview 載入的 Seata Saga Designer 託管網址（僅接受 https 或 localhost）。'],
            ['seataSaga.defaultFormat', 'yaml', '建立新狀態機或自動建立子狀態機檔案時的預設格式（yaml 或 json）。'],
            ['seataSaga.syncDiagnostics', 'true', '是否將即時拓樸驗證錯誤與警告同步顯示至 VS Code「問題（Problems）」面板。'],
            ['seataSaga.autoScanSubMachines', 'true', '是否自動掃描工作區內的 *.saga.* 檔案以支援跨檔 SubStateMachine 雙擊鑽取。'],
          ],
        },
      },
    ],
  },
  {
    index: '08',
    slug: '08-schema-and-faq',
    category: '規格參考',
    title: 'Seata STATE_LANG 規格參考與常見問題',
    summary:
      'Apache Seata Saga STATE_LANG JSON / YAML 核心欄位總表、Input/Output 參數表達式語法速查，以及匯入、註解保留與 VS Code 部署常見問題解答。',
    readTime: '5 分鐘閱讀',
    keywords: ['STATE_LANG', 'Schema', 'JSONPath', 'SpEL', 'Retry', 'Status', 'FAQ', '常見問題'],
    sections: [
      {
        id: 'top-level-schema',
        heading: '狀態機頂層與任務欄位規格總表',
        paragraphs: [
          '以下整理本設計器完整支援並可雙向序列化至 JSON 與 YAML 的 Apache Seata Saga 核心屬性：',
        ],
        table: {
          headers: ['欄位名稱', '層級', '型別', '說明'],
          rows: [
            ['Name', '頂層', 'string', '狀態機全域唯一識別名稱，亦作為 SubStateMachine 呼叫時的參照鍵。'],
            ['StartState', '頂層', 'string', '流程啟動後第一個執行的 State 名稱。'],
            ['Version', '頂層', 'string', '狀態機語意版本號（例如 0.0.1 或 1.2.0）。'],
            ['Type', '頂層', 'string', '固定為 STATE_LANG，代表 Apache Seata 狀態語言規範。'],
            ['Persist', '頂層', 'boolean', '是否將狀態機執行與補償日誌持久化至 Seata Server 資料庫。'],
            ['ServiceName / ServiceMethod', 'ServiceTask', 'string', '目標 SpringBean、Dubbo 或 SofaRPC 服務名稱與方法簽章。'],
            ['CompensateState', 'Task / SubMachine', 'string', '對應補償狀態名稱，該目標節點須設定 IsForCompensation: true。'],
            ['Input / Output', 'Task / SubMachine', 'array / object', '從上下文提取參數（$.[key]）與寫回執行結果（$.#root）的映射規則。'],
            ['Status', 'ServiceTask', 'object', '依據回傳值或例外動態判定 SU（成功）、FA（失敗）或 UN（未知）。'],
            ['Catch / Retry', 'Task / SubMachine', 'array', '定義例外類別捕獲轉移目標（Next）與指數退避重試策略（IntervalSeconds、MaxAttempts、BackoffRate）。'],
          ],
        },
      },
      {
        id: 'expression-cheatsheet',
        heading: 'Input / Output 與 Choice 表達式速查',
        paragraphs: [
          '在 Seata Saga 與本設計器的內建模擬器中，常用的上下文取值與條件判斷語法如下：',
        ],
        codeBlock: {
          language: 'yaml',
          title: '常用參數映射與條件判斷語法',
          code: `# Input：從流程上下文（Context）擷取欄位傳入服務方法
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
Default: Fail`,
        },
      },
      {
        id: 'faq',
        heading: '常見問題排除（FAQ）',
        paragraphs: [
          '以下彙整團隊在設計流程、維護 YAML 註解與使用 VS Code Web Extension 時最常遇到的問題與建議解法：',
        ],
        table: {
          headers: ['常見問題', '解決方式'],
          rows: [
            [
              '匯入舊版純 JSON 檔案沒有 style.bounds 座標，節點全部重疊怎麼辦？',
              '載入無座標 JSON/YAML 時系統會自動套用拓樸排版；您也可隨時點擊工作列「自動排版」重新整理主流程與補償節點位置。',
            ],
            [
              '為什麼某些編輯操作後想確認 YAML 註解是否仍完整保留？',
              '只要原始檔以 YAML 格式匯入或套用，系統就會保存 AST 範本；切換至「雙欄同步」並選擇 YAML 即可即時檢視所有表頭、行內與區塊 # 註解。',
            ],
            [
              '在雙擊 SubStateMachine 時跳出循環參考提示是什麼意思？',
              '代表該節點的 StateMachineName 直接或間接指向了目前呼叫鏈中的父狀態機，為避免無限遞迴系統已自動阻斷，請修改 StateMachineName 指向正確子流程。',
            ],
            [
              '在 vscode.dev 載入 Web Extension 時無法連線設計器怎麼辦？',
              '請確認 VS Code 設定 seataSaga.designerUrl 為有效的 HTTPS 位址（本機測試可使用 http://localhost:3000），且該部署網址允許被瀏覽器 iframe 內嵌。',
            ],
          ],
        },
      },
    ],
  },
];

const CHAPTERS_EN: DocChapter[] = [
  {
    index: '01',
    slug: '01-getting-started',
    category: 'Getting Started',
    title: 'Overview & Quick-Start Guide',
    summary:
      'Explore the Apache Seata Saga State Machine Designer workspace, official built-in templates, keyboard shortcuts, and a 3-step workflow to craft your first distributed transaction.',
    readTime: '4 min read',
    keywords: ['getting started', 'workspace', 'shortcuts', 'Seata Saga', 'templates', 'dark mode'],
    sections: [
      {
        id: 'workspace-anatomy',
        heading: 'Workspace Anatomy',
        paragraphs: [
          'Seata Saga State Machine Designer brings visual state graph editing, property inspection, bidirectional JSON/YAML editing, compensation simulation, and VS Code Web Extension packaging into one focused engineering workspace.',
          'On startup, the official Apache Seata reduceInventoryAndBalance example loads automatically so you can inspect forward tasks, Choice branching, Catch boundaries, and LIFO compensation immediately.',
        ],
        figures: [
          {
            src: '/docs/images/01-overview-canvas.png',
            alt: 'Full workspace overview of Seata Saga State Machine Designer',
            caption:
              'Figure 1-1: Complete workspace overview showing the top view switcher, utility toolbar, collapsible state palette, interactive canvas, and right property inspector.',
            annotations: [
              {
                label: 'Top Navigation Bar',
                detail:
                  'Switch cleanly between Designer, Split View, JSON / YAML, Simulator, and Docs, with a primary Export JSON action on the right.',
              },
              {
                label: 'Workspace Toolbar',
                detail:
                  'Switch templates, view machine metrics, trigger Undo/Redo, Auto Layout, Import/Export YAML & SVG, Diagnostics, VS Code Extension packaging, Locale (ZH/EN), and Light/Dark theme.',
              },
              {
                label: 'Collapsible State Palette',
                detail:
                  'Contains 4 canvas interaction modes and all 8 official Seata state types with click-or-drag creation and an edge collapse handle.',
              },
              {
                label: 'Property Inspector',
                detail:
                  'Shows global state machine configuration when nothing is selected, or contextual state/edge editors upon selection.',
              },
            ],
          },
        ],
      },
      {
        id: 'three-step-quickstart',
        heading: 'Create Your First Saga in 3 Steps',
        paragraphs: [
          'Follow these three steps to build, validate, and export an Apache Seata Saga definition:',
        ],
        steps: [
          'Pick a template from the Workspace Toolbar (Inventory & Balance Deduction, Order Fulfillment + SubStateMachine, or Blank Starter).',
          'Drag ServiceTask, ScriptTask, Choice, or SubStateMachine states onto the canvas, connect ports for Next/Choice/Catch/CompensateState transitions, and configure fields in the right inspector.',
          'Click Validate to ensure 0 errors, test failure and rollback scenarios in Simulator, and export as comment-preserving YAML or JSON.',
        ],
      },
      {
        id: 'shortcuts-and-preferences',
        heading: 'Keyboard Shortcuts & Controls',
        paragraphs: [
          'All core canvas actions support standard desktop engineering shortcuts whenever no input field is focused:',
        ],
        table: {
          headers: ['Shortcut / Control', 'Action', 'Scope'],
          rows: [
            ['Ctrl + Z / Cmd + Z', 'Undo last edit (tracked independently per sub-state machine)', 'Canvas & Split View'],
            ['Ctrl + Y / Shift + Ctrl + Z', 'Redo undone edit', 'Canvas & Split View'],
            ['Alt + Left Arrow', 'Return from a drilled-down SubStateMachine to its parent machine', 'SubStateMachine View'],
            ['Escape', 'Cancel active connection mode or close open dialogs', 'Global'],
            ['Mouse Wheel / Drag Canvas', 'Zoom (40%–200%) and pan smoothly with Fit View & Reset controls', 'Canvas Viewport'],
          ],
        },
      },
    ],
  },
  {
    index: '02',
    slug: '02-canvas-and-states',
    category: 'Visual Design',
    title: 'Visual Canvas & Seata State Nodes',
    summary:
      'Master all 8 official Apache Seata Saga state types, 4 transition semantics, quick-append floating controls, and collapsible left/right edge handles.',
    readTime: '6 min read',
    keywords: ['ServiceTask', 'ScriptTask', 'Choice', 'SubStateMachine', 'CompensationTrigger', 'edge handles', 'auto layout'],
    sections: [
      {
        id: 'interactive-canvas',
        heading: 'Interactive Canvas, Quick Actions & Collapsible Side Panels',
        paragraphs: [
          'Selecting any node reveals a floating quick-action bar on its right edge so you can append ServiceTask, Choice, CompensationTask, or Succeed states in a single click.',
          'Use the edge collapse handles mounted on both the left state palette and right inspector/code panel to reclaim full horizontal viewport width when editing wide workflows.',
        ],
        figures: [
          {
            src: '/docs/images/02-canvas-node-selected.png',
            alt: 'Canvas with ReduceInventory selected showing floating quick-action bar and property inspector',
            caption:
              'Figure 2-1: Selecting ReduceInventory displays the quick-append bar, complete ServiceTask inspector, and left/right edge collapse handles.',
          },
        ],
      },
      {
        id: 'eight-state-types',
        heading: 'All 8 Official Seata Saga State Types',
        paragraphs: [
          'Every state type defined by Apache Seata STATE_LANG is natively modeled with dedicated styling and property forms:',
        ],
        table: {
          headers: ['State Type', 'Role', 'Key Properties'],
          rows: [
            ['StartState', 'Entry Point', 'Maps to top-level StartState reference; single start node per machine.'],
            ['ServiceTask', 'Microservice Call', 'ServiceType (SpringBean/Dubbo/SofaRPC), ServiceName, ServiceMethod, CompensateState, Input/Output, Status, Retry, Catch.'],
            ['ScriptTask', 'Inline Script', 'Executes Groovy or inline expressions (ScriptType, ScriptContent) for risk checks or transformations.'],
            ['Choice', 'Conditional Gateway', 'Evaluates ordered SpEL Choices[] expressions with an optional Default branch.'],
            ['SubStateMachine', 'Nested Sub-Workflow', 'Delegates execution via StateMachineName; double-click on canvas to drill down and edit.'],
            ['CompensationTrigger', 'Rollback Trigger', 'Triggers LIFO reverse compensation for all previously completed compensable tasks.'],
            ['Succeed', 'Success End', 'Marks normal transaction completion and commit.'],
            ['Fail', 'Failure End', 'Terminates the workflow with explicit ErrorCode and Message metadata.'],
          ],
        },
      },
      {
        id: 'four-edge-types',
        heading: '4 Transition Semantics & Automatic Layout',
        paragraphs: [
          'Solid slate arrows represent Next/Choice/Default transitions, dashed indigo arrows denote CompensateState bindings, and dotted amber arrows indicate Catch exception boundaries.',
          'Click Auto Layout at any time to compute topological columns automatically while aligning compensation tasks neatly beneath their forward service tasks.',
        ],
        callout: {
          kind: 'tip',
          title: 'One-Click Compensation Scaffolding',
          body: 'Select any ServiceTask and click the indigo Undo arrow in the floating quick-action bar to automatically create an IsForCompensation partner task positioned directly underneath and wired via CompensateState.',
        },
      },
    ],
  },
  {
    index: '03',
    slug: '03-split-view-sync',
    category: 'Split Synchronization',
    title: 'Split View Sync & Line Flash Highlight',
    summary:
      'Work side-by-side across the visual canvas and JSON/YAML editor with instant jump-to-location scrolling and luminous block flash highlights.',
    readTime: '4 min read',
    keywords: ['split view', 'line highlight', 'flash', 'source locator', 'JSON', 'YAML'],
    sections: [
      {
        id: 'click-to-flash',
        heading: 'Click-to-Locate & Block Flash Effect',
        paragraphs: [
          'Switch to Split View in the top navigation bar to pair the canvas with a line-numbered JSON/YAML source editor.',
          'Clicking any node or transition edge invokes the deterministic Source Locator, smoothly scrolls the exact block into view within 240ms, displays the line span badge (e.g. ReduceBalance · L59-88), and flashes the matched source lines.',
        ],
        figures: [
          {
            src: '/docs/images/03-split-view-flash.png',
            alt: 'Split View mode highlighting ReduceBalance at lines 59-88 in YAML',
            caption:
              'Figure 3-1: Clicking ReduceBalance in Split View scrolls directly to lines L59-88 in YAML and flashes the highlighted block.',
          },
        ],
      },
      {
        id: 'bidirectional-editing',
        heading: 'Bidirectional Sync & Layout Bounds Toggle',
        paragraphs: [
          'Visual edits immediately regenerate the source pane. Direct edits in the JSON/YAML editor enable Apply to Canvas for instant re-parsing and canvas synchronization.',
          'Toggle Include layout bounds (style) whenever you want to omit visual coordinates for minimal production payloads.',
        ],
        callout: {
          kind: 'info',
          title: 'Edge-Level Precision',
          body: 'Clicking Choice labels, purple CompensateState arrows, or amber Catch arrows jumps straight to the matching Choices, CompensateState, or Catch lines inside the source state block.',
        },
      },
    ],
  },
  {
    index: '04',
    slug: '04-yaml-comments',
    category: 'YAML Engineering',
    title: 'YAML Import/Export & # Comment Preservation',
    summary:
      'Understand how the YAML v2 AST reconciliation pipeline preserves header, block, inline, array, and trailing # comments across visual canvas edits.',
    readTime: '5 min read',
    keywords: ['YAML', 'comments', 'AST', 'import', 'export', 'format'],
    sections: [
      {
        id: 'comment-preservation-demo',
        heading: 'Lossless # Comment Preservation',
        paragraphs: [
          'Production Seata Saga YAML files often carry essential business annotations and operational comments. Naive JSON-to-YAML re-serialization destroys every # comment.',
          'Our YAML v2 Document AST reconciler preserves header comments, block comments, inline comments, sequence item comments, and trailing comments across node drags, property edits, and state renames.',
        ],
        figures: [
          {
            src: '/docs/images/04-yaml-comments-editor.png',
            alt: 'YAML editor preserving header, inline, and block # comments',
            caption:
              'Figure 4-1: Commented Seata YAML synced to the visual canvas while retaining header, StartState inline, and ReduceInventory block comments intact.',
          },
        ],
      },
      {
        id: 'ast-pipeline-diagram',
        heading: 'YAML AST Reconciliation Pipeline',
        paragraphs: [
          'When YAML is imported or applied, the original text is retained alongside the SagaGraph as yamlTemplate. Subsequent exports reconcile updated values and renamed state keys in place inside the YAML Document AST so original comments stay anchored.',
        ],
        diagram: {
          id: 'yaml-ast-pipeline',
          title: 'YAML v2 AST Comment-Preserving Pipeline',
          caption:
            'Diagram 4-1: Original YAML feeds both the visual graph and AST template; edits reconcile in place to emit comment-safe .saga.yaml.',
        },
      },
      {
        id: 'yaml-example',
        heading: 'Commented Seata Saga YAML Example',
        paragraphs: [
          'Paste this commented YAML into the JSON / YAML view or import it as a .saga.yaml file to test lossless preservation:',
        ],
        codeBlock: {
          language: 'yaml',
          title: 'orderInventory.saga.yaml',
          code: `# Apache Seata Saga inventory & balance workflow
# All forward ServiceTasks must register a CompensateState
Name: reduceInventoryAndBalance
Comment: Reduce inventory then reduce balance
StartState: ReduceInventory # Workflow entry point
Version: 1.0.0
Type: STATE_LANG
Persist: true
States:
  # Step 1: Deduct inventory (compensated on downstream failure)
  ReduceInventory:
    Type: ServiceTask
    ServiceName: inventoryAction
    ServiceMethod: reduce
    ServiceType: SpringBean
    CompensateState: CompensateReduceInventory # Linked rollback task
    Input:
      - $. [businessKey] # Business order key
      - $. [count]       # Requested SKU count
    Next: Succeed`,
        },
      },
    ],
  },
  {
    index: '05',
    slug: '05-sub-state-machine',
    category: 'Nested Workflows',
    title: 'Multi-Level SubStateMachine Drill-Down',
    summary:
      'Navigate 3-level nested workflows (Order Fulfillment -> Payment Settlement -> Fraud Verification) via double-click drill-down, parent return breadcrumbs, cycle blocking, and isolated undo stacks.',
    readTime: '6 min read',
    keywords: ['SubStateMachine', 'nested', 'drill-down', 'breadcrumb', 'cycle protection'],
    sections: [
      {
        id: 'parent-drilldown',
        heading: 'Double-Click to Enter Any SubStateMachine',
        paragraphs: [
          'Switch the template dropdown to Order Fulfillment + SubStateMachine to inspect a realistic 3-level hierarchy. Double-click the sky-blue PaymentSubMachine node (or click Open SubStateMachine in the right inspector) to drill straight into paymentSettlementSubSaga.',
        ],
        figures: [
          {
            src: '/docs/images/05-submachine-parent.png',
            alt: 'Parent orderFulfillmentSaga with PaymentSubMachine selected',
            caption:
              'Figure 5-1: Selecting PaymentSubMachine in the root machine shows linked workspace status (9 states) and one-click drill-down.',
          },
        ],
      },
      {
        id: 'breadcrumb-return',
        heading: 'Hierarchical Breadcrumb & Instant Parent Return',
        paragraphs: [
          'Inside any nested state machine, the navigation breadcrumb bar displays your full call path and current depth. Click Back to Parent, click any ancestor crumb, or press Alt + Left Arrow to return to the parent machine with the originating SubStateMachine node automatically re-selected.',
        ],
        figures: [
          {
            src: '/docs/images/05-submachine-level2.png',
            alt: 'Drilled-down Level-2 paymentSettlementSubSaga with breadcrumb and Level-3 FraudSubCheck',
            caption:
              'Figure 5-2: Level-2 paymentSettlementSubSaga with Back to Parent breadcrumb and Level-3 FraudSubCheck ready for further drill-down.',
          },
        ],
      },
      {
        id: 'submachine-architecture',
        heading: 'Call Stack Architecture & Safety Guards',
        paragraphs: [
          'The workspace state engine enforces four production safety mechanisms across arbitrary nesting depths:',
        ],
        diagram: {
          id: 'submachine-stack',
          title: '3-Level SubStateMachine Call Stack & Guards',
          caption:
            'Diagram 5-1: Root-to-Level-3 navigation stack with auto-scaffolding, cycle protection, and isolated per-machine Undo/Redo history.',
        },
        steps: [
          'Auto-Scaffolding: Double-clicking a SubStateMachine referencing a new name automatically creates a starter workflow with StartState, ServiceTask, CompensationTask, and Succeed.',
          'Cycle Protection: Direct self-calls and multi-hop circular references are detected and blocked cleanly.',
          'Isolated Per-Machine History: Ctrl+Z inside a child workflow only reverts edits in that child machine.',
          'Automatic Rename Sync: Updating a child machine Name keeps its parent SubStateMachine StateMachineName reference synchronized.',
        ],
      },
    ],
  },
  {
    index: '06',
    slug: '06-validation-and-simulation',
    category: 'Validation & Simulation',
    title: 'Topology Validation & Compensation Simulator',
    summary:
      'Verify Seata STATE_LANG compliance in real time and dry-run forward execution, exception Catch transitions, and LIFO compensation rollbacks before deployment.',
    readTime: '5 min read',
    keywords: ['validator', 'simulator', 'LIFO', 'compensation', 'Catch', 'step-by-step'],
    sections: [
      {
        id: 'lifo-simulation',
        heading: 'Interactive Dry-Run & LIFO Rollback Simulation',
        paragraphs: [
          'Open Simulator from the top bar, edit the initial JSON context, and override task outcomes to SU, FA, or Throw Exception. Running a failure on ReduceBalance walks through Catch -> CompensationTrigger -> CompensateReduceInventory -> Fail while coloring every active node and edge live on the canvas.',
        ],
        figures: [
          {
            src: '/docs/images/06-simulation-compensation.png',
            alt: 'Saga Simulator executing a ReduceBalance exception and LIFO compensation rollback',
            caption:
              'Figure 6-1: Forcing Throw Exception on ReduceBalance traces Catch routing and LIFO compensation live on both the canvas and step trace panel.',
          },
        ],
      },
      {
        id: 'saga-lifecycle-diagram',
        heading: 'Forward Execution vs. LIFO Compensation Flow',
        paragraphs: [
          'Use Step Next to inspect context mutations one state at a time. Nested SubStateMachine nodes are recursively simulated as part of the full trace.',
        ],
        diagram: {
          id: 'saga-lifecycle',
          title: 'Seata Saga Forward Execution & LIFO Rollback Lifecycle',
          caption:
            'Diagram 6-1: Completed compensable tasks push onto the rollback stack and execute in reverse LIFO order when CompensationTrigger fires.',
        },
      },
      {
        id: 'validation-drawer',
        heading: 'Real-Time Diagnostics Drawer',
        paragraphs: [
          'Click Validate in the toolbar to inspect structural diagnostics. Clicking any error or warning immediately selects and focuses the offending node or edge on the canvas.',
        ],
        figures: [
          {
            src: '/docs/images/06-validation-drawer.png',
            alt: 'Validation drawer showing zero errors and zero warnings',
            caption:
              'Figure 6-2: Real-time validation drawer confirming full Apache Seata STATE_LANG compliance.',
          },
        ],
        table: {
          headers: ['Diagnostic Code', 'Severity', 'Rule Description'],
          rows: [
            ['NO_START_STATE', 'Error', 'Missing StartState node or missing outgoing transition from StartState.'],
            ['MISSING_SERVICE_META', 'Error', 'ServiceTask is missing required ServiceName or ServiceMethod.'],
            ['EMPTY_SCRIPT', 'Error', 'ScriptTask is missing executable ScriptContent.'],
            ['SUBMACHINE_SELF_CYCLE', 'Error', 'SubStateMachine references its own enclosing state machine name.'],
            ['UNRESOLVED_SUBMACHINE', 'Warning', 'Referenced sub-state machine does not yet exist in the workspace registry.'],
            ['UNREACHABLE_STATE', 'Warning', 'Non-compensation state cannot be reached from StartState.'],
          ],
        },
      },
    ],
  },
  {
    index: '07',
    slug: '07-vscode-extension',
    category: 'IDE Integration',
    title: 'VS Code Web & Desktop Extension Guide',
    summary:
      'Download a zero-build, zero-Node-dependency Universal VS Code Extension that runs natively in vscode.dev, github.dev, GitHub Codespaces, and VS Code Desktop.',
    readTime: '6 min read',
    keywords: ['VS Code', 'vscode.dev', 'github.dev', 'Web Extension', 'CustomTextEditorProvider', 'Webview Bridge'],
    sections: [
      {
        id: 'download-and-install',
        heading: 'One-Click Download & Zero-Build Installation',
        paragraphs: [
          'Click VS Code Ext in the workspace toolbar to configure your Hosted Designer URL and download a ready-to-run Universal Web Extension archive (seata-saga-vscode-web-extension.zip).',
          'Because the bundle declares "browser": "./dist/web/extension.js" and relies strictly on vscode.workspace.fs and Webview APIs with zero Node.js built-ins, it runs inside browser Web Workers on vscode.dev and github.dev as well as desktop VS Code.',
        ],
        figures: [
          {
            src: '/docs/images/07-vscode-modal-install.png',
            alt: 'VS Code Web & Desktop Extension modal showing download button and CLI commands',
            caption:
              'Figure 7-1: Configure the designer URL, download the ready-to-run .zip archive, or copy commands for @vscode/test-web, vscode.dev, and .vsix packaging.',
          },
        ],
        codeBlock: {
          language: 'bash',
          title: 'Launch & Packaging Commands',
          code: `# 1. Launch directly in browser-based VS Code (zero build required)
npx @vscode/test-web --browserType=chromium --extensionDevelopmentPath=./seata-saga-vscode-web

# 2. Sideload into vscode.dev / github.dev (then run F1 -> Developer: Install Web Extension)
npx serve --cors ./seata-saga-vscode-web

# 3. Package as .vsix for Desktop VS Code or Visual Studio Marketplace
cd seata-saga-vscode-web && npx @vscode/vsce package --target web && code --install-extension seata-saga-designer-1.0.0.vsix`,
        },
      },
      {
        id: 'live-webview-bridge',
        heading: 'Interactive Live Webview Bridge Sandbox',
        paragraphs: [
          'Switch to the Live Webview Bridge tab inside the modal to test the real ?embed=vscode postMessage protocol right in your browser. Click any node inside the embedded designer to observe live Reveal Source line synchronization, Problems panel diagnostics, theme mirroring, and workspace sub-machine drill-down.',
        ],
        figures: [
          {
            src: '/docs/images/07-vscode-live-bridge.png',
            alt: 'Live VS Code Webview Bridge simulator showing orderFulfillment.saga.yaml and Reveal PaymentSubMachine (L78-98)',
            caption:
              'Figure 7-2: Live Webview Bridge sandbox proving real bidirectional postMessage sync, dark theme mirroring, narrow-pane auto-collapse, and Reveal Source line tracking.',
          },
        ],
      },
      {
        id: 'vscode-bridge-diagram',
        heading: 'Dual-Runtime Host Bridge Architecture & Settings',
        paragraphs: [
          'The Webview enforces strict Content-Security-Policy rules (allowing only https:// or http://localhost origins) and origin-checked postMessage relaying, integrating seamlessly with VS Code native save, undo, Git Diff, Problems diagnostics, and multi-file sub-machine scanning.',
        ],
        diagram: {
          id: 'vscode-bridge',
          title: 'VS Code Web & Desktop Dual-Runtime Bridge Architecture',
          caption:
            'Diagram 7-1: CustomTextEditorProvider and CSP-verified Webview relay synchronize documents, workspace sub-machines, diagnostics, and source line highlights.',
        },
        table: {
          headers: ['VS Code Setting', 'Default', 'Description'],
          rows: [
            ['seataSaga.designerUrl', 'Current app origin', 'Hosted designer URL loaded inside the Webview (https or localhost only).'],
            ['seataSaga.defaultFormat', 'yaml', 'Default file format for newly scaffolded root and sub-state machines (yaml or json).'],
            ['seataSaga.syncDiagnostics', 'true', 'Publish topology errors and warnings directly into the VS Code Problems panel.'],
            ['seataSaga.autoScanSubMachines', 'true', 'Scan workspace *.saga.* files automatically for cross-file SubStateMachine drill-down.'],
          ],
        },
      },
    ],
  },
  {
    index: '08',
    slug: '08-schema-and-faq',
    category: 'Reference',
    title: 'Seata STATE_LANG Schema Reference & FAQ',
    summary:
      'Complete Apache Seata Saga STATE_LANG field reference, Input/Output & Choice expression cheat sheet, and troubleshooting FAQ.',
    readTime: '5 min read',
    keywords: ['STATE_LANG', 'schema', 'JSONPath', 'SpEL', 'Retry', 'Status', 'FAQ'],
    sections: [
      {
        id: 'top-level-schema',
        heading: 'Core State Machine & Task Fields',
        paragraphs: [
          'Reference table of Apache Seata STATE_LANG fields supported bidirectionally across both JSON and YAML:',
        ],
        table: {
          headers: ['Field', 'Scope', 'Type', 'Description'],
          rows: [
            ['Name', 'Root', 'string', 'Unique identifier for the state machine and target key for SubStateMachine calls.'],
            ['StartState', 'Root', 'string', 'Name of the initial state executed when the machine starts.'],
            ['Version', 'Root', 'string', 'Semantic version string (e.g. 0.0.1 or 1.2.0).'],
            ['Type', 'Root', 'string', 'Fixed value STATE_LANG per Apache Seata specification.'],
            ['Persist', 'Root', 'boolean', 'Persists state execution and compensation logs to the Seata store.'],
            ['ServiceName / ServiceMethod', 'ServiceTask', 'string', 'Target SpringBean, Dubbo, or SofaRPC bean and method name.'],
            ['CompensateState', 'Task / SubMachine', 'string', 'Partner compensation state name (target must have IsForCompensation: true).'],
            ['Input / Output', 'Task / SubMachine', 'array / object', 'Context extraction ($.[key]) and return value mapping ($.#root).'],
            ['Status', 'ServiceTask', 'object', 'Expression mapping to classify execution outcome as SU, FA, or UN.'],
            ['Catch / Retry', 'Task / SubMachine', 'array', 'Exception catch routing (Next) and exponential backoff retry policies.'],
          ],
        },
      },
      {
        id: 'expression-cheatsheet',
        heading: 'Input / Output & Choice Expression Cheat Sheet',
        paragraphs: [
          'Common expression syntax supported by Apache Seata Saga and our built-in simulator:',
        ],
        codeBlock: {
          language: 'yaml',
          title: 'Common Expressions',
          code: `# Input: extract context variables into service arguments
Input:
  - "$.[businessKey]"
  - "$.[amount]"

# Output: write service return value (#root) back into workflow context
Output:
  reduceInventoryResult: "$.#root"

# Choice Expression: evaluate boolean or numeric comparisons
Choices:
  - Expression: "[reduceInventoryResult] == true"
    Next: ReduceBalance
  - Expression: "[riskScore] < 80"
    Next: PaymentSubMachine
Default: Fail`,
        },
      },
      {
        id: 'faq',
        heading: 'Frequently Asked Questions',
        paragraphs: [
          'Solutions to the most common questions during workflow modeling, YAML comment preservation, and VS Code Web deployment:',
        ],
        table: {
          headers: ['Question', 'Solution'],
          rows: [
            [
              'Imported legacy JSON lacks style.bounds coordinates and nodes overlap.',
              'The parser auto-layouts coordinate-free files on load, and you can run Auto Layout from the toolbar anytime.',
            ],
            [
              'How can I verify that YAML # comments are preserved after visual edits?',
              'Keep the source imported/applied as YAML and inspect it in Split View (YAML tab) — header, block, inline, and trailing # comments remain intact.',
            ],
            [
              'Why did double-clicking a SubStateMachine display a cycle warning?',
              'The node StateMachineName points directly or indirectly to an active ancestor machine. Update StateMachineName to break the recursion cycle.',
            ],
            [
              'Why does the Webview fail to load inside vscode.dev?',
              'Verify seataSaga.designerUrl uses an HTTPS origin (or http://localhost:3000 locally) and allows iframe embedding.',
            ],
          ],
        },
      },
    ],
  },
];

export function getDocsChapters(locale: Locale): DocChapter[] {
  return locale === 'zh-TW' ? CHAPTERS_ZH : CHAPTERS_EN;
}

export function getDocsChapterBySlug(
  slug: string,
  locale: Locale
): DocChapter | undefined {
  return getDocsChapters(locale).find((ch) => ch.slug === slug);
}

export function searchDocsChapters(
  query: string,
  locale: Locale
): DocChapter[] {
  const chapters = getDocsChapters(locale);
  const clean = query.trim().toLowerCase();
  if (!clean) return chapters;

  return chapters.filter((ch) => {
    const haystack = [
      ch.index,
      ch.category,
      ch.title,
      ch.summary,
      ...ch.keywords,
      ...ch.sections.flatMap((sec) => [
        sec.heading,
        ...sec.paragraphs,
        ...(sec.steps ?? []),
        sec.callout?.title ?? '',
        sec.callout?.body ?? '',
        ...(sec.table?.rows.flat() ?? []),
      ]),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(clean);
  });
}

export function renderChapterToMarkdown(
  chapter: DocChapter,
  options?: { imageBasePath?: string }
): string {
  const imageBase = options?.imageBasePath ?? '../public/docs/images';
  const lines: string[] = [];

  lines.push(`# ${chapter.index}. ${chapter.title}`);
  lines.push('');
  lines.push(`> ${chapter.summary}`);
  lines.push('');
  lines.push(`**分類**：${chapter.category} · **閱讀時間**：${chapter.readTime}`);
  lines.push('');

  for (const sec of chapter.sections) {
    lines.push(`## ${sec.heading}`);
    lines.push('');

    for (const p of sec.paragraphs) {
      lines.push(p);
      lines.push('');
    }

    if (sec.steps && sec.steps.length > 0) {
      sec.steps.forEach((step, idx) => {
        lines.push(`${idx + 1}. ${step}`);
      });
      lines.push('');
    }

    if (sec.figures && sec.figures.length > 0) {
      for (const fig of sec.figures) {
        const fileName = fig.src.split('/').pop() ?? fig.src;
        lines.push(`![${fig.alt}](${imageBase}/${fileName})`);
        lines.push('');
        lines.push(`*${fig.caption}*`);
        lines.push('');
        if (fig.annotations && fig.annotations.length > 0) {
          for (const ann of fig.annotations) {
            lines.push(`- **${ann.label}**：${ann.detail}`);
          }
          lines.push('');
        }
      }
    }

    if (sec.diagram) {
      lines.push(`### ${sec.diagram.title}`);
      lines.push('');
      lines.push(`*${sec.diagram.caption}*`);
      lines.push('');
    }

    if (sec.table) {
      lines.push(`| ${sec.table.headers.join(' | ')} |`);
      lines.push(`| ${sec.table.headers.map(() => '---').join(' | ')} |`);
      for (const row of sec.table.rows) {
        lines.push(
          `| ${row.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`
        );
      }
      lines.push('');
    }

    if (sec.codeBlock) {
      if (sec.codeBlock.title) {
        lines.push(`**${sec.codeBlock.title}**`);
        lines.push('');
      }
      lines.push(`\`\`\`${sec.codeBlock.language}`);
      lines.push(sec.codeBlock.code);
      lines.push('```');
      lines.push('');
    }

    if (sec.callout) {
      lines.push(`> **${sec.callout.title}**`);
      lines.push(`> ${sec.callout.body}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function buildDocsMarkdownFiles(
  locale: Locale,
  options?: { imageBasePath?: string }
): ZipEntryInput[] {
  const chapters = getDocsChapters(locale);
  const imageBase = options?.imageBasePath ?? '../public/docs/images';

  const readmeLines: string[] = [
    locale === 'zh-TW'
      ? '# Apache Seata Saga State Machine Designer 完整使用與架構說明文件'
      : '# Apache Seata Saga State Machine Designer — Complete Illustrated Documentation',
    '',
    locale === 'zh-TW'
      ? '本系列文件涵蓋視覺化設計器、雙欄行號閃爍同步、YAML `#` 註解保留、多層 `SubStateMachine` 巢狀鑽取、分散式事務補償模擬與 VS Code 瀏覽器／桌面版擴充套件的完整圖文操作指南。'
      : 'Complete illustrated documentation covering visual workflow modeling, Split View flash sync, YAML # comment preservation, multi-level SubStateMachine drill-down, LIFO compensation simulation, and the Universal VS Code Web & Desktop Extension.',
    '',
    locale === 'zh-TW' ? '## 文件目錄' : '## Table of Contents',
    '',
    ...chapters.map(
      (ch) =>
        `- [${ch.index}. ${ch.title}](./${ch.slug}.md) — ${ch.summary}`
    ),
    '',
  ];

  const entries: ZipEntryInput[] = [
    {
      path: 'README.md',
      content: readmeLines.join('\n'),
    },
  ];

  for (const ch of chapters) {
    entries.push({
      path: `${ch.slug}.md`,
      content: renderChapterToMarkdown(ch, { imageBasePath: imageBase }),
    });
  }

  return entries;
}

export function buildDocsZipArchive(locale: Locale): Uint8Array {
  const mdFiles = buildDocsMarkdownFiles(locale, {
    imageBasePath: './images',
  });
  const prefixed: ZipEntryInput[] = mdFiles.map((entry) => ({
    path: `seata-saga-designer-docs/${entry.path}`,
    content: entry.content,
  }));
  return buildZipArchive(prefixed);
}
