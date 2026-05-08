/**
 * example_usage.js
 * Đăng nhập OneBSS → Hủy đặt cọc → thực hiện đầy đủ các bước theo steps.txt
 *
 * Steps:
 *   1. Chọn Dịch vụ: Băng rộng cố định
 *   2. Chọn Ngày thoái: 01/05/2026
 *   3. Nhập Số máy/Acc: NAN.TV.1836173 + Enter → chờ danh sách đặt cọc load
 *   4. Tích Người giới thiệu → popup → chọn dòng 4 (VNPT012132) → Chấp nhận
 *
 * Chạy: node example_usage.js
 */

import { appendFileSync, readFileSync } from "fs";
import { By, createBrowser, Key, until } from "./selenium_tool.js";

const ERROR_LOG = "./error_rows.txt";
function logErrorRow(soMayAcc, reason) {
    const line = `${new Date().toISOString()} | SoMay/Acc: ${soMayAcc} | Lỗi: ${reason}\n`;
    appendFileSync(ERROR_LOG, line, "utf8");
    console.error(`[ERROR_LOG] ${line.trim()}`);
}

/* ================================================================
   CẤU HÌNH
   ================================================================ */
const CONFIG = {
    url: "https://onebss.vnpt.vn",
    username: "anhtuancntt.nan",
    password: "H#x8x3at",
    targetUrl: "https://onebss.vnpt.vn/#/ext-hopdong/huy-dat-coc",

    dichVu: "Băng rộng cố định",
    ngayThoai: "01/05/2026",
    soMayAcc: "NAN_THANHTAM68",
    maNhanVien: "VNPT012132",   // dòng thứ 4 trong popup
};

// Đọc danh sách Số máy/Acc từ somay.txt (bỏ qua dòng tiêu đề MA_TB)
const soMayList = readFileSync("./somay.txt", "utf8")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && l.toUpperCase() !== "MA_TB");

/* ================================================================
   MAIN
   ================================================================ */
async function main() {
    const browser = await createBrowser({
        headless: false,
        timeout: 20_000,
    });

    try {
        // ── Bước 1: Đăng nhập (bạn tự nhập OTP trên trình duyệt) ──────────
        await browser.loginManual({
            url: CONFIG.url,
            username: CONFIG.username,
            password: CONFIG.password,
        });
        console.log("[1] Đăng nhập thành công:", await browser.currentUrl());
        console.log(`[INFO] Tổng số Số máy/Acc cần xử lý: ${soMayList.length}`);

        // ── Outer loop: lần lượt từng Số máy/Acc trong somay.txt ──────────
        for (const soMay of soMayList) {
            console.log(`\n[SOMAY] ════ Xử lý: ${soMay} ════`);
            const soMayStart = Date.now();
            try {

                // ── Bước 2: Vào trang Hủy đặt cọc ────────────────────────────────
                await browser.goto(CONFIG.targetUrl);
                await browser.waitForVisible(".select2-container", 15_000);
                await browser.sleep(800);
                console.log("[2] Đã vào trang Hủy đặt cọc.");

                // ── Bước 3: Tích chọn Người giới thiệu (chỉ click nếu chưa được tick) ───────────────
                const isChecked = await browser.driver.executeScript(
                    `const el = document.querySelector('input.check'); return el ? el.checked : false;`
                );
                if (!isChecked) {
                    await browser.jsClick("input.check");
                    await browser.sleep(1200);
                    console.log("[3] Đã tick Người giới thiệu, chờ popup...");
                } else {
                    console.log("[3] Người giới thiệu đã tick sẵn.");
                }

                // ── Bước 4: Chờ popup "Chọn người giới thiệu" xuất hiện ──────────
                await browser.waitForVisible(".popup-body.control-ngt", 10_000);
                await browser.sleep(300);
                console.log("[4] Popup đã mở.");

                // ── Bước 5: Click vào dòng chứa VNPT012132 trong bảng popup ──────
                const rowXpath = `//div[contains(@class,'popup-body')]//table//tbody/tr[.//td[normalize-space(text())='${CONFIG.maNhanVien}']]`;
                const row = await browser.findByXpath(rowXpath);
                await row.click();
                await browser.sleep(300);
                console.log("[5] Đã chọn dòng VNPT012132.");

                // ── Bước 6: Click nút "Chấp nhận" trong popup ────────────────────
                const chapNhanXpath = `//*[contains(@class,'popup-body') or contains(@class,'popup-header')]//*[normalize-space(text())='Chấp nhận']`;
                const chapNhanBtn = await browser.findByXpath(chapNhanXpath);
                await chapNhanBtn.click();
                await browser.sleep(1000);
                console.log("[6] Đã click Chấp nhận.");

                // ── Bước 7: Chọn Dịch vụ = "Băng rộng cố định" ───────────────────
                await browser.selectSelect2(1, CONFIG.dichVu);
                try {
                    await browser.waitForHidden(".loading, .spinner, .blockUI, .e-spinner-pane", 8_000);
                } catch { /* không có spinner thì bỏ qua */ }
                await browser.waitForVisible("input.form-control.highlight", 15_000);
                console.log("[7] Đã chọn Dịch vụ:", CONFIG.dichVu);
                const soMayEls = await browser.findAllByCss("input.form-control.highlight");
                const soMayInput = soMayEls[1]; // index 1 = Số máy/Acc
                await soMayInput.clear();
                await soMayInput.sendKeys(soMay, Key.ENTER);
                console.log("[8] Đã nhập Số máy/Acc:", soMay);

                // Kiểm tra toast lỗi sớm (1.5s): nếu có "Không có thông tin đặt cọc" thì bỏ qua ngay
                await browser.sleep(1500);
                const earlyError = await browser.driver.executeScript(`
                    const toasts = document.querySelectorAll('.toast, .alert, [class*="notify"], [class*="toast"], [class*="snack"]');
                    for (const t of toasts) {
                        const txt = t.textContent || '';
                        if (txt.includes('Kh\u00f4ng c\u00f3 th\u00f4ng tin \u0111\u1eb7t c\u1ecdc') ||
                            txt.includes('kh\u00f4ng t\u1ed3n t\u1ea1i') || txt.includes('Kh\u00f4ng t\u00ecm th\u1ea5y')) {
                            const s = getComputedStyle(t);
                            if (s.display !== 'none' && s.visibility !== 'hidden') return txt.trim().substring(0, 100);
                        }
                    }
                    return null;
                `);
                if (earlyError) {
                    const elapsed = ((Date.now() - soMayStart) / 1000).toFixed(1);
                    console.log(`[8] Lỗi sớm cho ${soMay}: "${earlyError}" — bỏ qua. (${elapsed}s)`);
                    logErrorRow(soMay, earlyError);
                    continue;
                }

                // Chờ spinner "Đang nạp nội dung..." biến mất (nếu có)
                try {
                    await browser.driver.wait(async () => {
                        const els = await browser.driver.findElements(
                            By.xpath(`//*[contains(text(),'Đang nạp nội dung')]`)
                        );
                        if (els.length === 0) return true;
                        for (const el of els) {
                            try {
                                const vis = await browser.driver.executeScript(
                                    `const s = getComputedStyle(arguments[0]);
                             return s.display !== 'none' && s.visibility !== 'hidden' && !!arguments[0].offsetParent;`,
                                    el
                                );
                                if (vis) return false;
                            } catch { /* stale */ }
                        }
                        return true;
                    }, 15_000);
                    console.log("[8] Spinner đã biến mất.");
                } catch (_) { /* không có spinner */ }

                // Chờ danh sách đặt cọc load xong:
                // Đợi bảng render xong: xuất hiện e-emptyrow HOẶC có dữ liệu thực (tối đa 10s)
                const datTableRowXpath = `//table[.//th[contains(.,'Số tháng')]]//tbody/tr[td][not(contains(@class,'e-emptyrow'))][not(contains(@class,'e-filterrow'))]`;
                const emptyRowXpath = `//table[.//th[contains(.,'Số tháng')]]//tbody/tr[contains(@class,'e-emptyrow')]`;
                await browser.driver.wait(async () => {
                    const data = await browser.driver.findElements(By.xpath(datTableRowXpath));
                    if (data.length > 0) return true;
                    const empty = await browser.driver.findElements(By.xpath(emptyRowXpath));
                    return empty.length > 0;
                }, 10_000, "Timeout chờ bảng đặt cọc render");

                // Kiểm tra rỗng
                const initialRows = await browser.driver.findElements(By.xpath(datTableRowXpath));
                if (initialRows.length === 0) {
                    const elapsed = ((Date.now() - soMayStart) / 1000).toFixed(1);
                    console.log(`[8] Không có đặt cọc cho ${soMay} — bỏ qua. (${elapsed}s)`);
                    logErrorRow(soMay, 'Không có thông tin đặt cọc cũ');
                    continue;
                }
                // Poll thêm chỉ nếu có khả năng đang load dở (count lẻ hoặc còn thay đổi)
                let rowCount8 = initialRows.length;
                for (let attempt = 0; attempt < 5; attempt++) {
                    await browser.sleep(200);
                    const rows = await browser.driver.findElements(By.xpath(datTableRowXpath));
                    if (rows.length === rowCount8) break; // ổn định ngay
                    rowCount8 = rows.length;
                }
                console.log(`[8] Danh sách đặt cọc đã load (${rowCount8} hàng).`);

                // 3. Click dòng đầu tiên trong bảng để chọn
                const firstRowXpath = `//table[.//th[contains(.,'Số tháng')]]//tbody/tr[td][not(contains(@class,'e-emptyrow'))][not(contains(@class,'e-filterrow'))][1]`;
                const firstRow = await browser.driver.wait(
                    until.elementLocated(By.xpath(firstRowXpath)),
                    10_000, "Timeout chờ dòng đầu tiên trong danh sách đặt cọc"
                );
                await browser.driver.executeScript("arguments[0].click();", firstRow);
                await browser.sleep(200);
                console.log("[8] Đã click dòng đầu tiên trong danh sách đặt cọc.");

                // ── Bước 9: Chọn Ngày thoái = 01/05/2026 (sau cùng để tránh bị reset) ──
                const dpEl = await browser.findById("ej2-datepicker_2");
                await browser.driver.executeScript("arguments[0].removeAttribute('readonly');", dpEl);
                await dpEl.click();
                await browser.sleep(300);
                await dpEl.clear();
                await dpEl.sendKeys("01/05/2026", Key.TAB);
                await browser.sleep(200);
                console.log("[9] Đã chọn Ngày thoái:", CONFIG.ngayThoai);

                // ── Bước 10: Lặp qua từng hàng trong Danh sách đặt cọc ──────────
                const rowCount = rowCount8;
                console.log(`[10] Bảng đặt cọc có ${rowCount} hàng.`);

                if (rowCount === 0) {
                    const elapsed = ((Date.now() - soMayStart) / 1000).toFixed(1);
                    console.log(`[10] Không có đặt cọc cho ${soMay} — bỏ qua. (${elapsed}s)`);
                    logErrorRow(soMay, 'Bảng đặt cọc rỗng');
                    continue;
                }

                for (let i = 0; i < rowCount; i++) {
                    console.log(`\n[Row ${i + 1}/${rowCount}] ════════════════════════════`);
                    try {
                        // B: Click "Ghi lại" — chờ nút xuất hiện và visible trước khi click
                        const ghiLaiXpath = `//button[contains(normalize-space(.),'Ghi lại')] | //a[contains(normalize-space(.),'Ghi lại')]`;
                        await browser.driver.wait(
                            until.elementLocated(By.xpath(ghiLaiXpath)), 10_000
                        );
                        const ghiLaiEl = await browser.driver.findElement(By.xpath(ghiLaiXpath));
                        await browser.driver.wait(until.elementIsVisible(ghiLaiEl), 5_000);
                        await browser.driver.executeScript("arguments[0].click();", ghiLaiEl);
                        await browser.sleep(1500);

                        // Kiểm tra lỗi ngay sau Ghi lại bằng JS (nhanh hơn XPath)
                        const ghiLaiErr = await browser.driver.executeScript(`
                            const selectors = ['.toast-error, .alert-danger, [class*="toast"][class*="error"], [class*="notify"]'];
                            const all = document.querySelectorAll('.toast, .alert, [class*="toastr"], [class*="notification"], [class*="snack"]');
                            for (const t of all) {
                                const s = getComputedStyle(t);
                                if (s.display === 'none' || s.visibility === 'hidden') continue;
                                const txt = (t.textContent || '').trim();
                                if (txt && (t.className.includes('error') || t.className.includes('danger') ||
                                    txt.includes('kh\u00f4ng th\u1ec3') || txt.includes('ch\u01b0a ho\u00e0n thi\u1ec7n') ||
                                    txt.includes('kh\u00f4ng t\u1ed3n t\u1ea1i') || txt.includes('Kh\u00f4ng t\u00ecm th\u1ea5y') ||
                                    txt.includes('kh\u00f4ng h\u1ee3p l\u1ec7') || txt.includes('b\u1ea1n kh\u00f4ng th\u1ec3'))) {
                                    return txt.substring(0, 150);
                                }
                            }
                            return null;
                        `);
                        if (ghiLaiErr) {
                            console.error(`[Row ${i + 1}] B: LỖI Ghi lại → "${ghiLaiErr}"`);
                            logErrorRow(soMay, ghiLaiErr);
                            continue;
                        }

                        // Kiểm tra thành công (tùy chọn)
                        const successEls = await browser.driver.findElements(
                            By.xpath(`//*[contains(normalize-space(.),'thành công')]`)
                        );
                        if (successEls.length > 0) {
                            const msg = await successEls[0].getText().catch(() => '');
                            console.log(`[Row ${i + 1}] B: Ghi lại → "${msg.trim()}"`);
                        } else {
                            console.log(`[Row ${i + 1}] B: Ghi lại xong.`);
                        }

                        // Chờ spinner "Đang nạp nội dung" sau Ghi lại (nếu có)
                        await browser.sleep(300);
                        try {
                            await browser.driver.wait(async () => {
                                const els = await browser.driver.findElements(
                                    By.xpath(`//*[contains(text(),'Đang nạp nội dung')]`)
                                );
                                if (els.length === 0) return true;
                                for (const el of els) {
                                    try {
                                        const vis = await browser.driver.executeScript(
                                            `const s = getComputedStyle(arguments[0]);
                                     return s.display !== 'none' && s.visibility !== 'hidden' && !!arguments[0].offsetParent;`,
                                            el
                                        );
                                        if (vis) return false;
                                    } catch { /* stale */ }
                                }
                                return true;
                            }, 30_000);
                            console.log(`[Row ${i + 1}] B: Spinner sau Ghi lại đã biến mất.`);
                        } catch (_) { /* không có spinner */ }

                        // C: Click nút "Thanh toán" trong toolbar
                        // Nút là <a href="javascript:void(0)"> nằm trực tiếp trong ul.list (không phải dropdown)
                        const ttBtn = await browser.driver.wait(
                            until.elementLocated(By.xpath(
                                `//ul[contains(@class,'list')]//a[normalize-space(.)='Thanh toán' and @href='javascript:void(0)'] |` +
                                `//ul[contains(@class,'list')]//a[@href='javascript:void(0)'][.//*[contains(@class,'shopping-credit')] or normalize-space(.)='Thanh toán']`
                            )),
                            10_000
                        );
                        await browser.driver.executeScript("arguments[0].click();", ttBtn);
                        await browser.sleep(500);
                        console.log(`[Row ${i + 1}] C: Đã click nút Thanh toán.`);
                        // Chờ form Thanh toán HĐ load: đợi label "Loại hoá đơn" trong dialog xuất hiện
                        await browser.driver.wait(
                            until.elementLocated(By.xpath(
                                `//*[contains(@class,'e-dlg-content') or contains(@class,'popupComponentPayment')]` +
                                `//*[contains(.,'Loại hoá đơn') or contains(.,'Loại hóa đơn')]`
                            )),
                            15_000
                        );
                        // Chờ spinner trong form biến mất
                        await browser.sleep(300);
                        try {
                            await browser.driver.wait(async () => {
                                const els = await browser.driver.findElements(
                                    By.xpath(`//*[contains(text(),'Đang nạp nội dung')]`)
                                );
                                if (els.length === 0) return true;
                                for (const el of els) {
                                    try {
                                        const vis = await browser.driver.executeScript(
                                            `const s = getComputedStyle(arguments[0]);
                                     return s.display !== 'none' && s.visibility !== 'hidden' && !!arguments[0].offsetParent;`,
                                            el
                                        );
                                        if (vis) return false;
                                    } catch { /* stale */ }
                                }
                                return true;
                            }, 30_000);
                        } catch (_) { /* không có spinner */ }
                        // Chờ dữ liệu form được điền: "Tên khách hàng" không còn trống
                        await browser.driver.wait(async () => {
                            const els = await browser.driver.findElements(
                                By.xpath(`//*[contains(text(),'Tên khách hàng')]/following-sibling::* | //*[normalize-space(@placeholder)='Tên khách hàng']`)
                            );
                            for (const el of els) {
                                try {
                                    const val = await el.getText() || await el.getAttribute('value');
                                    if (val && val.trim()) return true;
                                } catch { /* stale */ }
                            }
                            // Fallback: chờ Tổng tiền trả có giá trị khác 0
                            const totals = await browser.driver.findElements(
                                By.xpath(`//*[contains(text(),'Tổng tiền trả')]/following::input[1] | //*[contains(text(),'Tổng tiền trả')]/following::*[self::input or self::span][1]`)
                            );
                            for (const el of totals) {
                                try {
                                    const val = await el.getText() || await el.getAttribute('value');
                                    if (val && val.trim() && val.trim() !== '0') return true;
                                } catch { /* stale */ }
                            }
                            return false;
                        }, 20_000, "Timeout chờ dữ liệu form Thanh toán load");
                        await browser.sleep(500);
                        console.log(`[Row ${i + 1}] C: Form Thanh toán HĐ đã load xong.`);

                        // D: Bỏ tick "Loại hóa đơn" — scope trong popup Thanh toán HĐ (e-dlg-content)
                        // Cấu trúc: <div class="check-action"><input class="check"><span class="name">Loại hoá đơn</span></div>
                        try {
                            const loaiHDInput = await browser.driver.wait(
                                until.elementLocated(By.xpath(
                                    `//*[contains(@class,'e-dlg-content') or contains(@class,'popupComponentPayment')]` +
                                    `//div[contains(@class,'check-action')]` +
                                    `[.//*[contains(@class,'name') and (contains(.,'Loại hoá đơn') or contains(.,'Loại hóa đơn'))]]` +
                                    `//input[@type='checkbox']`
                                )),
                                5_000
                            );
                            const isChecked = await browser.driver.executeScript(`return arguments[0].checked;`, loaiHDInput);
                            console.log(`[Row ${i + 1}] D: Loại hóa đơn checked=${isChecked}`);
                            if (isChecked) {
                                await browser.driver.executeScript("arguments[0].scrollIntoView({block:'center'});", loaiHDInput);
                                await browser.sleep(200);
                                // Click trực tiếp input (selenium native click)
                                await loaiHDInput.click();
                                await browser.sleep(400);
                                const afterCheck = await browser.driver.executeScript(`return arguments[0].checked;`, loaiHDInput);
                                console.log(`[Row ${i + 1}] D: Sau click checked=${afterCheck}`);
                                if (afterCheck) {
                                    // Fallback: JS click input
                                    await browser.driver.executeScript("arguments[0].click();", loaiHDInput);
                                    await browser.sleep(300);
                                }
                                console.log(`[Row ${i + 1}] D: Đã bỏ tick Loại hóa đơn.`);
                            } else {
                                console.log(`[Row ${i + 1}] D: Loại hóa đơn đã bỏ tick sẵn.`);
                            }
                        } catch (e) {
                            console.warn(`[Row ${i + 1}] D: Không tìm thấy checkbox Loại hóa đơn: ${e.message}`);
                        }

                        // E: Click "Thanh toán" trong toolbar của popup → dialog xác nhận
                        const ttPopupBtn = await browser.driver.wait(
                            until.elementLocated(By.xpath(
                                `//*[contains(@class,'e-dlg-content') or contains(@class,'popupComponentPayment')]` +
                                `//ul[contains(@class,'list')]//a[@href='javascript:void(0)']` +
                                `[normalize-space(.)='Thanh toán' or contains(normalize-space(.),'Thanh toán')]`
                            )),
                            10_000
                        );
                        await browser.driver.executeScript("arguments[0].click();", ttPopupBtn);
                        await browser.sleep(800);
                        console.log(`[Row ${i + 1}] E: Đã click Thanh toán trong popup.`);

                        // F: Xác nhận dialog "Bạn xác nhận thanh toán hợp đồng này?" → click "Thanh toán" (btn-primary)
                        const confirmBtn1 = await browser.driver.wait(
                            until.elementLocated(By.xpath(
                                `//div[contains(@class,'modal') and contains(@class,'show')]` +
                                `//*[contains(@class,'modal-footer')]//button[contains(@class,'btn-primary')]`
                            )),
                            10_000
                        );
                        await browser.driver.executeScript("arguments[0].scrollIntoView({block:'center'});", confirmBtn1);
                        await browser.driver.executeScript("arguments[0].click();", confirmBtn1);
                        await browser.sleep(1200);
                        console.log(`[Row ${i + 1}] F: Xác nhận dialog lần 1.`);

                        // G: Xác nhận dialog lần 2 ("Bạn có muốn thanh toán cho các thuê bao này không?")
                        // Dùng JS tìm đúng modal chứa text "thuê bao" để tránh click nhầm dialog 1 đang fade
                        try {
                            const clicked2 = await browser.driver.wait(async () => {
                                return await browser.driver.executeScript(`
                            const modals = document.querySelectorAll('.modal.show');
                            for (const m of modals) {
                                if (m.textContent.includes('thu\u00ea bao')) {
                                    const btn = m.querySelector('footer.modal-footer .btn-primary, .modal-footer .btn-primary');
                                    if (btn) { btn.click(); return true; }
                                }
                            }
                            return false;
                        `);
                            }, 10_000, "Timeout chờ dialog 2 thuê bao");
                            await browser.sleep(1500);
                            console.log(`[Row ${i + 1}] G: Xác nhận dialog lần 2.`);
                        } catch {
                            await browser.sleep(1000);
                            console.log(`[Row ${i + 1}] G: Không có dialog lần 2.`);
                        }

                        // H: Click nút X (Close) để đóng form Thanh toán EJ2 dialog
                        await browser.sleep(500);
                        const closeBtn = await browser.driver.wait(
                            until.elementLocated(By.xpath(
                                `//div[contains(@class,'e-dialog')]//div[contains(@class,'e-dlg-header-content')]` +
                                `//button[@title='Close' or @aria-label='Close']`
                            )),
                            10_000, "Timeout chờ nút X đóng form Thanh toán"
                        );
                        await browser.driver.executeScript("arguments[0].click();", closeBtn);
                        await browser.sleep(300);
                        console.log(`[Row ${i + 1}] H: Đã click X đóng form Thanh toán.`);

                        // H2: Chờ form Thanh toán ẩn đi (có thể vẫn còn trong DOM nhưng hidden)
                        await browser.driver.wait(async () => {
                            const dlgs = await browser.driver.findElements(
                                By.xpath(`//div[contains(@class,'e-dlg-content')]//div[contains(@class,'popupComponentPayment')]`)
                            );
                            if (dlgs.length === 0) return true;
                            // Kiểm tra tất cả đều không còn visible
                            for (const el of dlgs) {
                                const visible = await browser.driver.executeScript(
                                    `const s = getComputedStyle(arguments[0]);
                             return s.display !== 'none' && s.visibility !== 'hidden' && arguments[0].offsetParent !== null;`,
                                    el
                                );
                                if (visible) return false;
                            }
                            return true;
                        }, 15_000, "Timeout chờ form Thanh toán đóng");
                        await browser.sleep(200);
                        console.log(`[Row ${i + 1}] H2: Form Thanh toán đã đóng, về trang Hủy đặt cọc.`);

                        // I: Click "Hoàn thiện" trong toolbar ul.list của trang chính
                        const hoanThienBtn = await browser.driver.wait(
                            until.elementLocated(By.xpath(
                                `//div[contains(@class,'frm-thaydoi-datcoc-huy') or contains(@class,'list-actions-top')]` +
                                `//ul[contains(@class,'list')]//a[@href='javascript:void(0)']` +
                                `[normalize-space(.)='Hoàn thiện' or contains(normalize-space(.),'Hoàn thiện')]`
                            )),
                            10_000
                        );
                        await browser.driver.executeScript("arguments[0].click();", hoanThienBtn);
                        await browser.sleep(800);
                        console.log(`[Row ${i + 1}] I: Đã click Hoàn thiện.`);

                        // J: Xác nhận dialog "Thông báo" sau Hoàn thiện → click "Đồng ý" / btn-primary
                        // Có thể xuất hiện: "Không tìm thấy thông tin hóa đơn..." hoặc dialog xác nhận khác
                        // footer.modal-footer (thẻ <footer>, không phải <div>)
                        await browser.driver.wait(async () => {
                            return await browser.driver.executeScript(`
                                const modals = document.querySelectorAll('.modal.show');
                                for (const m of modals) {
                                    if (getComputedStyle(m).display === 'none') continue;
                                    const btn = m.querySelector('.modal-footer .btn-primary');
                                    if (btn && !btn.disabled) { btn.click(); return true; }
                                }
                                return false;
                            `);
                        }, 15_000, "Timeout chờ dialog Thông báo sau Hoàn thiện");
                        await browser.sleep(600);
                        console.log(`[Row ${i + 1}] J: Đã click Đồng ý. ✓ Hoàn thành hàng ${i + 1}.`);

                    } catch (rowErr) {
                        console.error(`[Row ${i + 1}] LỖI:`, rowErr.message);
                        logErrorRow(soMay, rowErr.message);
                        // Tiếp tục sang hàng tiếp theo
                    }
                }

                const elapsed = ((Date.now() - soMayStart) / 1000).toFixed(1);
                console.log(`\n[OK] Đã xử lý xong ${rowCount} hàng cho ${soMay}. (${elapsed}s)`);

            } catch (soMayErr) {
                const elapsed = ((Date.now() - soMayStart) / 1000).toFixed(1);
                console.error(`[SOMAY LỖI] ${soMay}: ${soMayErr.message} (${elapsed}s)`);
                logErrorRow(soMay, soMayErr.message);
            }
        } // end for soMayList

    } catch (err) {
        console.error("[ERROR]", err.message);
    } finally {
        // await browser.close();
        console.log("[INFO] Trình duyệt vẫn mở. Nhấn Ctrl+C để thoát.");
    }
}

main();


