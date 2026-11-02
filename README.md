# 超市場景雛型（Stage 1）

留學生活 galgame 的第一個場景。玩家用英文跟店員 Maya 對話，在 $25 內買齊購物清單。

## 執行
```bash
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...        # Windows PowerShell: $env:OPENAI_API_KEY="sk-..."
python main.py
```
用免費的 GitHub Models（建議）：在同資料夾建立 `.env`
```
LLM_BASE_URL=https://models.github.ai/inference
LLM_API_KEY=github_pat_你的token
MODEL=openai/gpt-4o-mini
```
其他 OpenAI 相容服務（Groq、Cerebras、OpenRouter）也是改這三行。Gemini 則是 `MODEL=gemini-…` 加 `GEMINI_API_KEY=…`。

## 檔案
| 檔案 | 內容 |
| --- | --- |
| `db.py` | SQLite：商品（價格、走道、庫存）、玩家金錢、購物籃、購買紀錄、任務清單 |
| `tools.py` | 店員的 5 個工具：`find_product`、`add_to_cart`、`remove_from_cart`、`view_cart`、`checkout`；規則檢查都在這裡 |
| `main.py` | 店員人設（XML Prompt）、對話迴圈、場景結束時由程式判定任務結果 |

## 設計重點
- 價格、庫存、金錢只存在資料庫，工具不接受價格參數，LLM 沒辦法打折或送東西。
- 清單寫 scallions，店裡標 green onions；oat milk 缺貨；買太多會刷卡失敗，都是設計好的對話情境。
- 場景完成與否由程式判定，不交給 LLM。