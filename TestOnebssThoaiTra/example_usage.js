/**
 * example_usage.js
 * Thoái trả hợp đồng (Quyền Admin)
 * Trang: https://onebss.vnpt.vn/#/Payment/CancellationContract?tag=0
 *
 * Steps:
 *   1. Bỏ tick "Từ ngày"
 *   2. Chọn "Nguyên nhân TT" = "Trùng hợp đồng"
 *   3. Nhập Mã giao dịch từ magd.txt + Enter
 *   4. Nếu bảng "Phiếu thanh toán" có dữ liệu → click hàng đầu tiên
 *   5. Click "Thoái trả" nếu có dữ liệu
 *   Lỗi popup → ghi vào error_magd.txt và error_rows.txt
 *
 * Chạy: node example_usage.js
 */

import { appendFileSync, existsSync, readFileSync } from "fs";
import { By, createBrowser, Key, until } from "./selenium_tool.js";

/* ================================================================
   FILE PATHS
   ================================================================ */
const MAGD_FILE = "./magd.txt";
const DONE_FILE = "./done.txt";
const ERROR_LOG = "./error_rows.txt";
const ERROR_MAGD = "./error_magd.txt";

/* ================================================================
   CẤU HÌNH
   ================================================================ */
const CONFIG = {
    url: "https://onebss.vnpt.vn",
    username: "anhtuancntt.nan",
    password: "H#x8x3at",
    targetUrl: "https://onebss.vnpt.vn/#/Payment/CancellationContract?tag=0",
};

/* ================================================================
   LOG HELPERS
   ================================================================ */
function logError(maGD, reason) {
    const ts = new Date().toISOString();
    const detail = `${ts} | Mã GD: ${maGD} | Lỗi: ${reason}\n`;
    appendFileSync(ERROR_LOG, detail, "utf8");
    appendFileSync(ERROR_MAGD, `${maGD}\n`, "utf8");
    console.error(`[ERROR] ${maGD} → ${reason}`);
}

function markDone(maGD) {
    appendFileSync(DONE_FILE, `${maGD}\n`, "utf8");
}

/* ================================================================
   SESSION
   ================================================================ */
async function ensureLoggedIn(browser) {
    const url = await browser.currentUrl();
    if (url.includes("/auth/login")) {
        console.log("[SESSION] Session hết hạn → đăng nhập lại...");
        try {
            await browser.loginManual({
                url: CONFIG.url,
                username: CONFIG.username,
                password: CONFIG.password,
            });
        } catch {
            console.error("[SESSION] Timeout chờ OTP — thoát.");
            process.exit(1);
        }
    }
}

/* ================================================================
   HELPERS
   ================================================================ */

async function uncheckTuNgay(browser) {
    try {
        const el = await browser.driver.wait(
            until.elementLocated(By.xpath(
                `//div[contains(@class,'check-action')]` +
                `[.//span[@class='name' and normalize-space(text())='T\u1EEB ng\u00E0y']]` +
                `//input[@class='check']`
            )),
            8_000
        );
        const checked = await browser.driver.executeScript(`return arguments[0].checked;`, el);
        if (checked) {
            await browser.driver.executeScript("arguments[0].click();", el);
            await browser.sleep(300);
            console.log("[B1] Đã bỏ tick 'Từ ngày'.");
        } else {
            console.log("[B1] 'Từ ngày' đã bỏ tick sẵn.");
        }
    } catch (e) {
        console.warn(`[B1] Không tìm thấy checkbox 'Từ ngày': ${e.message}`);
    }
}

async function selectNguyenNhan(browser, value) {
    const container = await browser.driver.wait(
        until.elementLocated(By.xpath(
            `//div[contains(@class,'info-row')]` +
            `[.//div[@class='key' and normalize-space(text())='Nguy\u00EAn nh\u00E2n TT']]` +
            `//div[contains(@class,'multiselect')]`
        )),
        8_000
    );

    const currentVal = await browser.driver.executeScript(
        `const s = arguments[0].querySelector('.multiselect__single');
         return s ? s.textContent.trim() : '';`,
        container
    );
    if (currentVal === value) {
        console.log(`[B2] 'Nguyên nhân TT' đã chọn sẵn: ${value}`);
        return;
    }

    await browser.driver.executeScript("arguments[0].click();", container);
    await browser.sleep(400);

    const optXpath =
        `//div[contains(@class,'info-row')]` +
        `[.//div[@class='key' and normalize-space(text())='Nguy\u00EAn nh\u00E2n TT']]` +
        `//li[contains(@class,'multiselect__element')]` +
        `//span[contains(@class,'multiselect__option')]` +
        `/span[normalize-space(text())='${value}']`;

    const optEl = await browser.driver.wait(
        until.elementLocated(By.xpath(optXpath)),
        5_000
    );
    await browser.driver.executeScript("arguments[0].click();", optEl);
    await browser.sleep(300);
    console.log(`[B2] Đã chọn Nguyên nhân TT: ${value}`);
}

async function initForm(browser) {
    await uncheckTuNgay(browser);
    await selectNguyenNhan(browser, "Trùng hợp đồng");
}

async function waitForGridLoad(browser) {
    try {
        await browser.driver.wait(async () =>
            await browser.driver.executeScript(
                `return !!document.querySelector('.e-spinner-pane:not(.e-spin-hide)')`
            ),
            3_000
        );
    } catch { /* spinner chưa kịp hiện */ }
    try {
        await browser.driver.wait(async () =>
            await browser.driver.executeScript(
                `const all = document.querySelectorAll('.e-spinner-pane');
                 return all.length === 0 ||
                        Array.from(all).every(el => el.classList.contains('e-spin-hide'));`
            ),
            15_000
        );
    } catch { /* timeout */ }
    await browser.sleep(500);
}

async function countPhieuTTRows(browser) {
    return parseInt(await browser.driver.executeScript(`
        const grids = document.querySelectorAll('div.e-grid');
        for (const g of grids) {
            const ths = g.querySelectorAll('.e-headercontent th .e-headertext');
            if (!Array.from(ths).some(h => h.textContent.includes('M\u00E3 GD'))) continue;
            return g.querySelectorAll('.e-gridcontent tbody tr.e-row').length;
        }
        return 0;
    `)) || 0;
}

async function checkError(browser) {
    await browser.sleep(1200);
    return await browser.driver.executeScript(`
        const toasts = document.querySelectorAll(
            '.Vue-Toastification__toast--error, .Vue-Toastification__toast--warning'
        );
        for (const t of toasts) {
            const s = getComputedStyle(t);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            const txt = (t.textContent || '').trim();
            if (txt) return txt.substring(0, 300);
        }
        const generics = document.querySelectorAll('.toast-error, .alert-danger');
        for (const t of generics) {
            const s = getComputedStyle(t);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            const txt = (t.textContent || '').trim();
            if (txt) return txt.substring(0, 300);
        }
        const modals = document.querySelectorAll('.modal.show, .e-dlg-modal');
        for (const m of modals) {
            const s = getComputedStyle(m);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            const txt = (m.textContent || '').trim();
            const low = txt.toLowerCase();
            if (low.includes('l\u1ED7i') || low.includes('kh\u00F4ng th\u1EC3') ||
                low.includes('th\u1EA5t b\u1EA1i') || low.includes('error')) {
                return txt.substring(0, 300);
            }
        }
        return null;
    `);
}

async function closePopups(browser) {
    try {
        await browser.driver.executeScript(`
            document.querySelectorAll('.Vue-Toastification__close-button').forEach(b => b.click());
            document.querySelectorAll('.modal.show .close, .modal.show [data-dismiss="modal"]')
                     .forEach(b => b.click());
            document.querySelectorAll('.e-dlg-closeicon-btn').forEach(b => b.click());
        `);
        await browser.sleep(500);
    } catch { /* bỏ qua */ }
}

async function refreshAndCheckOTP(browser) {
    console.log("[F5] Làm mới trang kiểm tra OTP...");
    await browser.reload();
    await browser.sleep(2000);
    const url = await browser.currentUrl();
    if (url.includes("/auth/login")) {
        console.log("[F5] Phát hiện cần nhập lại OTP → đăng nhập lại...");
        try {
            await browser.loginManual({
                url: CONFIG.url,
                username: CONFIG.username,
                password: CONFIG.password,
            });
        } catch {
            console.error("[F5] Timeout chờ OTP — thoát.");
            process.exit(1);
        }
    }
    const curUrl = await browser.currentUrl();
    if (!curUrl.includes("CancellationContract")) {
        await browser.goto(CONFIG.targetUrl);
        await browser.sleep(2000);
    }
    await initForm(browser);
}

async function clickThoaiTra(browser) {
    const btn = await browser.driver.wait(
        until.elementLocated(By.xpath(
            `//div[contains(@class,'list-actions-top')]` +
            `//ul[contains(@class,'list')]` +
            `//li/a[not(contains(@class,'disabled'))]` +
            `[normalize-space(.)='Tho\u00E1i tr\u1EA3']`
        )),
        8_000
    );
    await browser.driver.executeScript("arguments[0].scrollIntoView({block:'center'});", btn);
    await browser.driver.executeScript("arguments[0].click();", btn);
}

/* ================================================================
   MAIN
   ================================================================ */
async function main() {
    const maGDList = readFileSync(MAGD_FILE, "utf8")
        .split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const doneSet = existsSync(DONE_FILE)
        ? new Set(readFileSync(DONE_FILE, "utf8").split(/\r?\n/).map(l => l.trim()).filter(Boolean))
        : new Set();

    const pending = maGDList.filter(m => !doneSet.has(m));
    console.log(`[INFO] Tổng: ${maGDList.length} | Đã xong: ${doneSet.size} | Còn lại: ${pending.length}`);

    if (pending.length === 0) {
        console.log("[INFO] Không còn mã GD nào cần xử lý.");
        return;
    }

    const browser = await createBrowser({ headless: false, timeout: 20_000 });

    try {
        await browser.loginManual({
            url: CONFIG.url,
            username: CONFIG.username,
            password: CONFIG.password,
        });
        console.log("[LOGIN] Đăng nhập thành công:", await browser.currentUrl());

        await browser.goto(CONFIG.targetUrl);
        await browser.sleep(2000);
        console.log("[NAV] Đã vào trang Thoái trả hợp đồng (Quyền Admin).");

        await initForm(browser);

        for (const maGD of pending) {
            console.log(`\n[MAGD] ════ ${maGD} ════`);

            try {
                await ensureLoggedIn(browser);

                const curUrl = await browser.currentUrl();
                if (!curUrl.includes("CancellationContract")) {
                    await browser.goto(CONFIG.targetUrl);
                    await browser.sleep(2000);
                    await initForm(browser);
                }

                // Bước 3: Nhập Mã GD + Enter
                const input = await browser.driver.wait(
                    until.elementLocated(
                        By.css(`div.input-more-button input.form-control.highlight`)
                    ),
                    8_000
                );
                await browser.driver.executeScript(
                    "arguments[0].scrollIntoView({block:'center'});", input
                );
                await input.click();
                await input.clear();
                await input.sendKeys(maGD, Key.ENTER);
                console.log(`[B3] Đã nhập Mã GD: ${maGD}`);

                await waitForGridLoad(browser);

                const errAfterEnter = await checkError(browser);
                if (errAfterEnter) {
                    console.error(`[B3] Lỗi sau Enter: ${errAfterEnter}`);
                    logError(maGD, errAfterEnter);
                    await closePopups(browser);
                    await refreshAndCheckOTP(browser);
                    continue;
                }

                // Bước 4: Chờ grid + kiểm tra dữ liệu
                await waitForGridLoad(browser);
                const rowCount = await countPhieuTTRows(browser);
                console.log(`[B4] Phiếu thanh toán: ${rowCount} hàng.`);

                if (rowCount === 0) {
                    console.log(`[B4] Không có dữ liệu — bỏ qua ${maGD}.`);
                    markDone(maGD);
                    await refreshAndCheckOTP(browser);
                    continue;
                }

                const firstRow = await browser.driver.wait(
                    until.elementLocated(By.xpath(
                        `(//div[contains(@class,'e-gridcontent')])[1]` +
                        `//tbody/tr[contains(@class,'e-row')][1]`
                    )),
                    8_000
                );
                await browser.driver.executeScript("arguments[0].click();", firstRow);
                await browser.sleep(300);
                console.log(`[B4] Đã chọn hàng đầu tiên.`);

                // Bước 5: Click "Thoái trả"
                await clickThoaiTra(browser);
                console.log(`[B5] Đã click Thoái trả.`);

                await waitForGridLoad(browser);

                const errAfterThoai = await checkError(browser);
                if (errAfterThoai) {
                    console.error(`[B5] Lỗi Thoái trả: ${errAfterThoai}`);
                    logError(maGD, errAfterThoai);
                    await closePopups(browser);
                } else {
                    console.log(`[B5] Thoái trả thành công cho ${maGD}.`);
                    markDone(maGD);
                }

                await browser.sleep(1000);
                await refreshAndCheckOTP(browser);

            } catch (err) {
                console.error(`[CATCH] ${maGD}: ${err.message}`);
                logError(maGD, err.message.substring(0, 250));
                try {
                    await refreshAndCheckOTP(browser);
                } catch { /* bỏ qua */ }
            }
        }

        console.log("\n[DONE] Hoàn thành xử lý tất cả Mã GD.");

    } catch (fatalErr) {
        console.error("[FATAL]", fatalErr.message);
    } finally {
        // await browser.close();
        console.log("[INFO] Trình duyệt vẫn mở. Nhấn Ctrl+C để thoát.");
    }
}

main();
