# ESP32 Web Flasher - CORS Issue & Solutions

## Vấn đề
Khi chạy file `esp_web_flasher_standalone.html` trực tiếp bằng cách double-click (protocol `file://`), browser sẽ chặn việc load file `firmware.json` do CORS policy.

## Giải pháp đã áp dụng

### 1. Embedded Database (Mặc định)
- Firmware database đã được nhúng trực tiếp vào file HTML
- Hoạt động với protocol `file://` 
- Không cần HTTP server

### 2. Dual Loading Strategy
```javascript
// Tự động detect protocol và chọn phương thức phù hợp:
if (window.location.protocol !== 'file:') {
    // HTTP/HTTPS: Thử load firmware.json external
    const response = await fetch('./firmware.json');
} else {
    // file://: Sử dụng embedded database
    firmwareDatabase = EMBEDDED_FIRMWARE_DATABASE;
}
```

## Cách sử dụng

### Phương pháp 1: Chạy trực tiếp (Khuyến nghị cho đơn giản)
1. Double-click `esp_web_flasher_standalone.html`
2. Sử dụng embedded firmware database
3. Tất cả tính năng hoạt động bình thường

### Phương pháp 2: Sử dụng Live Server (Khuyến nghị cho development)
1. Cài đặt Live Server extension trong VS Code
2. Right-click `esp_web_flasher_standalone.html` → "Open with Live Server"
3. Sẽ load external `firmware.json` (dễ dàng update)

### Phương pháp 3: HTTP Server thủ công
```powershell
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# Hoặc bất kỳ HTTP server nào khác
```

## Ưu điểm của từng phương pháp

| Phương pháp | Ưu điểm | Nhược điểm |
|-------------|---------|------------|
| File:// (Embedded) | ✅ Đơn giản, không cần setup | ❌ Cập nhật firmware list phải edit HTML |
| HTTP Server | ✅ Dễ cập nhật firmware.json | ❌ Cần setup server |

## Log Messages
- `🌐 Chạy từ http: - có thể load external firmware.json`
- `⚠️ Chạy từ file:// protocol - sử dụng embedded firmware database`

## Firmware Database Structure
```json
{
  "firmwareList": [
    {
      "id": "unique_id",
      "name": "Display Name",
      "filename": "file.bin",
      "flashAddress": "0x10000",
      "path": "url_or_local_path",
      "description": "Mô tả",
      "size": "123KB",
      "version": "1.0.0",
      "category": "Category Name"
    }
  ]
}
```

## Cập nhật Firmware Database

### Cách 1: Edit file firmware.json (HTTP mode)
- Chỉnh sửa `firmware.json`
- Refresh browser

### Cách 2: Edit embedded database (File mode)
- Tìm `EMBEDDED_FIRMWARE_DATABASE` trong HTML
- Cập nhật object JavaScript
- Save file