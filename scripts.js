// ESP32 Web Flasher JavaScript
import { ESPLoader, Transport } from "https://unpkg.com/esptool-js/bundle.js";
// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const flashBtn = document.getElementById('flashBtn');
const eraseBtn = document.getElementById('eraseBtn');
const fileInput = document.getElementById('fileInput');
const fileDrop = document.getElementById('fileDrop');
const browseBtn = document.getElementById('browseBtn');
const fileName = document.getElementById('fileName');
const firmwarePasswordInput = document.getElementById('firmwarePassword');
const verifyPasswordBtn = document.getElementById('verifyPasswordBtn');
const passwordHelp = document.getElementById('passwordHelp');
const getMacBtn = document.getElementById('getMacBtn');
const macAddressDisplay = document.getElementById('macAddressDisplay');
const copyMacBtn = document.getElementById('copyMacBtn');
const contactHDN77Link = document.getElementById('contactHDN77Link');
const firmwareList = document.getElementById('firmwareList');
const deviceMacAddressInput = document.getElementById('deviceMacAddress');
const progressBar = document.querySelector('#progress > i');
const percentEl = document.getElementById('percent');
const logEl = document.getElementById('log');
const chipInfoEl = document.getElementById('chipInfo');
const speedInfo = document.getElementById('speedInfo');
const clearLogBtn = document.getElementById('clearLogBtn');
const openOfficialBtn = document.getElementById('openOfficialBtn');
const flashAddressInput = document.getElementById('flashAddress');

// Global Variables
let device = null;
let transport = null;
let espLoader = null;
let chip = null;
let consoleBaudRate = 115200;
let selectedFile = null;
let startTime = 0;
let firmwareDatabase = null;


(function() {
    const _wl = [
        "\x37\x63\x3a\x32\x63\x3a\x36\x37\x3a\x38\x63\x3a\x37\x62\x3a\x61\x30",
        "\x37\x63\x3a\x32\x63\x3a\x36\x37\x3a\x38\x63\x3a\x38\x64\x3a\x66\x34",
        "\x64\x63\x3a\x62\x34\x3a\x64\x39\x3a\x31\x30\x3a\x35\x34\x3a\x30\x34",
        "\x37\x63\x3a\x32\x63\x3a\x36\x37\x3a\x38\x63\x3a\x38\x37\x3a\x63\x38",
        "\x33\x34\x3a\x63\x64\x3a\x62\x30\x3a\x30\x64\x3a\x31\x64\x3a\x62\x63",
        "\x39\x63\x3a\x31\x33\x3a\x39\x65\x3a\x61\x61\x3a\x65\x35\x3a\x38\x63",
        "\x64\x38\x3a\x33\x62\x3a\x64\x61\x3a\x37\x31\x3a\x36\x65\x3a\x34\x63",
        "\x65\x38\x3a\x66\x36\x3a\x30\x61\x3a\x38\x63\x3a\x62\x30\x3a\x31\x63",
        "\x37\x63\x3a\x32\x63\x3a\x36\x37\x3a\x38\x63\x3a\x38\x35\x3a\x31\x38",
        "\x64\x63\x3a\x62\x34\x3a\x64\x39\x3a\x31\x30\x3a\x35\x32\x3a\x37\x30",
        "\x38\x30\x3a\x62\x35\x3a\x34\x65\x3a\x64\x36\x3a\x62\x63\x3a\x66\x63",
        "\x31\x63\x3a\x64\x62\x3a\x64\x34\x3a\x61\x64\x3a\x63\x66\x3a\x62\x63",
        "\x64\x63\x3a\x62\x34\x3a\x64\x39\x3a\x31\x30\x3a\x35\x32\x3a\x39\x34",
        "\x31\x63\x3a\x64\x62\x3a\x64\x34\x3a\x61\x65\x3a\x38\x63\x3a\x31\x34"
    ];
    window.MAC_WHITELIST = _wl;
})();

// Serial library compatibility
const serialLib = !navigator.serial && navigator.usb ? serial : navigator.serial;

// Check if modules loaded correctly
console.log('ESPLoader:', typeof ESPLoader);
console.log('Transport:', typeof Transport);

// ESP Loader Terminal Interface
const espLoaderTerminal = {
    clean() {
        logEl.textContent = 'Log đã được xóa.';
    },
    writeLine(data) { // Hàm này được esptool-js gọi để in log
        log(data);
        // --- BẮT VÀ XỬ LÝ DÒNG LOG CHỨA ĐỊA CHỈ MAC ---
        if (data.startsWith('MAC: ')) {
            const macString = data.substring(5); // Cắt bỏ "MAC: "
            log(`✅ Tự động nhận diện địa chỉ MAC: ${macString}`);
            
            // Cập nhật giao diện người dùng với địa chỉ MAC vừa tìm thấy
            deviceMacAddressInput.value = macString;
            const macSpan = macAddressDisplay.querySelector('span');
            macSpan.textContent = `Địa chỉ MAC của thiết bị: ${macString}`;
            macAddressDisplay.classList.remove('d-none');
            copyMacBtn.classList.remove('d-none'); // Hiển thị nút sao chép
            
            // Kiểm tra xem MAC có trong whitelist không
            const normalizedMac = macString.toLowerCase();
            if (MAC_WHITELIST.includes(normalizedMac)) {
                log(`🔓 MAC này nằm trong danh sách whitelist - tự động bỏ qua xác thực mật khẩu`);
                passwordHelp.textContent = '✅ Thiết bị này thuộc Puppy HDN77 không cần pass! Đang tải danh sách firmware...';
                passwordHelp.classList.remove('text-danger');
                passwordHelp.classList.add('text-success');
                
                // Ẩn link liên hệ HDN77
                if (contactHDN77Link) {
                    contactHDN77Link.classList.add('d-none');
                }
                
                // Tự động load firmware database mà không cần mật khẩu
                loadFirmwareDatabase();
                
                // Vô hiệu hóa các trường mật khẩu
                firmwarePasswordInput.disabled = true;
                verifyPasswordBtn.disabled = true;
            } else {
                passwordHelp.textContent = 'Đã có địa chỉ MAC. Bây giờ hãy sao chép MAC và gửi cho HDN77 để lấy mật khẩu.';
                passwordHelp.classList.remove('text-danger');
                passwordHelp.classList.add('text-success');
                
                // Hiện link liên hệ HDN77 cho MAC không trong whitelist
                if (contactHDN77Link) {
                    contactHDN77Link.classList.remove('d-none');
                }
            }
        }
    },
    write(data) {
        log(data);
    },
};

// Utility Functions
function log(...args) {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logEl.textContent += `\n[${timestamp}] ${message}`;
    logEl.scrollTop = logEl.scrollHeight;
    console.log(...args);
}

function setProgress(percentage, bytesWritten = 0, totalBytes = 0) {
    progressBar.style.width = percentage + '%';
    percentEl.textContent = percentage + '%';
    
    if (bytesWritten && totalBytes && startTime) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = (bytesWritten / elapsed / 1024).toFixed(1);
        const remaining = totalBytes - bytesWritten;
        const eta = remaining / (bytesWritten / elapsed);
        speedInfo.textContent = `${speed} KB/s - ETA: ${eta.toFixed(0)}s`;
    }
}

function updateConnectionStatus(connected, chipName = '') {
    const indicator = chipInfoEl.querySelector('.status-indicator');
    if (connected) {
        indicator.className = 'status-indicator status-connected';
        chipInfoEl.innerHTML = `<span class="status-indicator status-connected"></span>Kết nối: ${chipName}`;
    } else {
        indicator.className = 'status-indicator status-disconnected';
        chipInfoEl.innerHTML = `<span class="status-indicator status-disconnected"></span>Chưa kết nối`;
    }
}

function enableControls(connected) {
    flashBtn.disabled = !connected || !selectedFile;
    eraseBtn.disabled = !connected;
    disconnectBtn.disabled = !connected;
    connectBtn.disabled = connected;
    getMacBtn.disabled = !connected; // Kích hoạt/Vô hiệu hóa nút lấy MAC
    if (!connected) {
        macAddressDisplay.classList.add('d-none');
        copyMacBtn.classList.add('d-none');
    }
}

function handleFileSelect(file) {
    if (!file) return;
    
    if (!file.name.endsWith('.bin')) {
        alert('Chỉ chấp nhận file .bin');
        return;
    }
    
    if (file.size > 16 * 1024 * 1024) {
        alert('File quá lớn (> 16MB)');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = `📁 ${file.name} (${(file.size/1024/1024).toFixed(2)}MB)`;
    log(`Đã chọn file: ${file.name}`);
    
    if (espLoader) {
        flashBtn.disabled = false;
    }
}

function readUploadedFileAsBinaryString(inputFile) {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onerror = () => {
            reader.abort();
            reject(new DOMException("Problem parsing input file."));
        };

        reader.onload = () => {
            resolve(reader.result);
        };
        reader.readAsBinaryString(inputFile);
    });
}

function parseFlashAddress(addressStr) {
    // Remove whitespace and convert to lowercase
    addressStr = addressStr.trim().toLowerCase();
    
    // Check if it starts with 0x
    if (!addressStr.startsWith('0x')) {
        throw new Error('Địa chỉ flash phải bắt đầu bằng "0x" (ví dụ: 0x10000)');
    }
    
    // Remove 0x prefix and validate hex format
    const hexStr = addressStr.slice(2);
    if (!/^[0-9a-f]+$/.test(hexStr)) {
        throw new Error('Địa chỉ flash chứa ký tự không hợp lệ. Chỉ được phép sử dụng 0-9, A-F');
    }
    
    // Convert to integer
    const address = parseInt(addressStr, 16);
    
    // Validate address range (should be reasonable for ESP32)
    if (address < 0 || address > 0x400000) { // 4MB max
        throw new Error('Địa chỉ flash không hợp lệ (0x0 - 0x400000)');
    }
    
    // Check alignment (should be divisible by 4096 for flash sectors)
    if (address % 4096 !== 0) {
        log(`⚠️ Cảnh báo: Địa chỉ ${addressStr} không căn chỉnh với sector (4KB). Khuyến nghị sử dụng địa chỉ chia hết cho 0x1000`);
    }
    
    return address;
}

function getFlashSizeFromId(flashId) {
    // Flash ID format: [Manufacturer ID][Memory Type][Capacity]
    // Capacity byte determines flash size
    const capacityByte = (flashId >> 16) & 0xFF;
    
    // Common flash size mappings based on JEDEC standard
    const flashSizes = {
        0x10: '64KB',    // 2^16 bytes
        0x11: '128KB',   // 2^17 bytes  
        0x12: '256KB',   // 2^18 bytes
        0x13: '512KB',   // 2^19 bytes
        0x14: '1MB',     // 2^20 bytes
        0x15: '2MB',     // 2^21 bytes
        0x16: '4MB',     // 2^22 bytes
        0x17: '8MB',     // 2^23 bytes
        0x18: '16MB',    // 2^24 bytes
        0x19: '32MB',    // 2^25 bytes
        0x1A: '64MB',    // 2^26 bytes
    };
    
    const manufacturer = flashId & 0xFF;
    const memoryType = (flashId >> 8) & 0xFF;
    
    // Log detailed flash information
    log(`Flash Manufacturer ID: 0x${manufacturer.toString(16).padStart(2, '0').toUpperCase()}`);
    log(`Flash Memory Type: 0x${memoryType.toString(16).padStart(2, '0').toUpperCase()}`);
    log(`Flash Capacity Code: 0x${capacityByte.toString(16).padStart(2, '0').toUpperCase()}`);
    
    // Get manufacturer name (based on JEDEC standard)
    const manufacturerNames = {
        0x20: 'Micron/Numonyx/ST',
        0x68: 'Boya',
        0x85: 'Puya',
        0x8C: 'ESMT',
        0x9D: 'ISSI',
        0x1C: 'EON',
        0xC2: 'MXIC',
        0xC8: 'GigaDevice', 
        0xEF: 'Winbond'
        // Note: Add new manufacturers only with verified JEDEC documentation
    };
    
    const manufacturerName = manufacturerNames[manufacturer] || `Unknown - ID 0x${manufacturer.toString(16).padStart(2, '0').toUpperCase()} (check JEDEC JEP106)`;
    log(`Flash Manufacturer: ${manufacturerName}`);
    
    const flashSize = flashSizes[capacityByte];
    if (flashSize) {
        log(`Detected flash size: ${flashSize}`);
        return flashSize;
    } else {
        log(`Unknown flash capacity code: 0x${capacityByte.toString(16).padStart(2, '0')}`);
        return 'Unknown Size';
    }
}

// --- THAY ĐỔI LOGIC XÁC THỰC MẬT KHẨU ---
verifyPasswordBtn.addEventListener('click', async () => {
    const mac = deviceMacAddressInput.value;
    const enteredPassword = firmwarePasswordInput.value;

    if (!mac) {
        passwordHelp.textContent = 'Vui lòng lấy địa chỉ MAC của thiết bị trước khi xác nhận mật khẩu.';
        passwordHelp.classList.add('text-danger');
        return;
    }

    // Kiểm tra whitelist trước
    const normalizedMac = mac.toLowerCase();
    if (MAC_WHITELIST.includes(normalizedMac)) {
        log(`🔓 MAC này nằm trong danh sách whitelist - bỏ qua xác thực mật khẩu`);
        passwordHelp.textContent = '✅ Thiết bị này được ủy quyền! Đang tải danh sách firmware...';
        passwordHelp.classList.remove('text-danger');
        passwordHelp.classList.add('text-success');
        firmwarePasswordInput.disabled = true;
        verifyPasswordBtn.disabled = true;
        await loadFirmwareDatabase();
        return;
    }

    if (!enteredPassword) {
        passwordHelp.textContent = 'Vui lòng nhập mật khẩu.';
        passwordHelp.classList.add('text-danger');
        return;
    }

    // Bước 1: Tạo "mật khẩu đúng" từ địa chỉ MAC
    const secretKey = (function(){const _k="\x48\x44\x4e\x37\x37\x2d\x53\x75\x70\x65\x72\x2d\x53\x65\x63\x72\x65\x74\x2d\x4b\x65\x79\x2d\x32\x30\x32\x35";return _k;})();
    const correctPasswordHash = CryptoJS.SHA256(mac + secretKey).toString();
    
    // Lấy 8 ký tự đầu của chuỗi hash làm mật khẩu để đơn giản hóa
    const correctPassword = correctPasswordHash.substring(0, 8);

    // Bước 2: So sánh mật khẩu người dùng nhập với mật khẩu đã tạo
    if (enteredPassword === correctPassword) {
        passwordHelp.textContent = 'Mật khẩu chính xác! Hãy chọn đúng Firmware từ danh sách phía dưới...';
        passwordHelp.classList.remove('text-danger');
        passwordHelp.classList.add('text-success');
        firmwarePasswordInput.disabled = true;
        verifyPasswordBtn.disabled = true;
        await loadFirmwareDatabase(); // Tải danh sách firmware full
    } else {
        passwordHelp.textContent = 'Mật khẩu không đúng. Vui lòng kiểm tra lại.';
        passwordHelp.classList.add('text-danger');
        firmwareList.classList.add('d-none'); // Ẩn danh sách nếu sai
    }
});

// Load public firmware database initially
async function loadPublicFirmwareDatabase() {
    try {
        log('Đang tải danh sách firmware công khai...');
        const response = await fetch('./firmware_public.json');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        firmwareDatabase = await response.json();
        log(`✅ Đã tải ${firmwareDatabase.firmwareList.length} firmware (công khai)`);

        populateFirmwareList();

    } catch (error) {
        log(`❌ Lỗi tải firmware database (công khai): ${error.message}`);

        // Fallback to empty list
        firmwareDatabase = { firmwareList: [], categories: [] };
        populateFirmwareList();
    }
}

// Firmware Database Functions
async function loadFirmwareDatabase() {
    try {
        log('Đang tải danh sách firmware...');
        const response = await fetch('./firmware001.json');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        firmwareDatabase = await response.json();
        log(`✅ Đã tải ${firmwareDatabase.firmwareList.length} firmware từ database`);
        
        populateFirmwareList();
        
    } catch (error) {
        log(`❌ Lỗi tải firmware database: ${error.message}`);
        
        // Fallback to default options
        const fallbackOptions = [
            { id: 'sample1', name: 'ESP32 Blink LED (Offline)', description: 'Sample firmware - offline mode' },
            { id: 'sample2', name: 'ESP32 WiFi Scanner (Offline)', description: 'Sample firmware - offline mode' },
            { id: 'sample3', name: 'ESP32 Web Server (Offline)', description: 'Sample firmware - offline mode' }
        ];
        
        const firmwareListEl = document.getElementById('firmwareList');
        firmwareListEl.innerHTML = '<option value="">-- Chọn firmware mẫu (offline) --</option>';
        
        fallbackOptions.forEach(fw => {
            const option = document.createElement('option');
            option.value = fw.id;
            option.textContent = fw.name;
            firmwareListEl.appendChild(option);
        });
    }
}

function populateFirmwareList() {
    const firmwareListEl = document.getElementById('firmwareList');
    
    // Clear loading state
    firmwareListEl.innerHTML = '<option value="">-- Chọn firmware từ danh sách --</option>';
    
    // Group by category
    const categories = {};
    firmwareDatabase.firmwareList.forEach(fw => {
        if (!categories[fw.category]) {
            categories[fw.category] = [];
        }
        categories[fw.category].push(fw);
    });
    
    // Add options grouped by category
    Object.keys(categories).sort().forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        
        categories[category].forEach(fw => {
            const option = document.createElement('option');
            option.value = fw.id;
            option.textContent = `${fw.name} (${fw.size})`;
            option.dataset.firmware = JSON.stringify(fw);
            optgroup.appendChild(option);
        });
        
        firmwareListEl.appendChild(optgroup);
    });

    // Hiện danh sách firmware sau khi tải thành công
    firmwareListEl.classList.remove('d-none');
}

// Synchronize log terminal height with left column content
function syncLogHeight() {
    // Only apply on desktop screens (xl and above)
    if (window.innerWidth >= 1200) {
        const leftColumn = document.querySelector('.col-xl-5');
        const rightColumn = document.querySelector('.col-xl-7');
        const logTerminal = document.getElementById('log');
        
        if (leftColumn && rightColumn && logTerminal) {
            // Get the height of left column content
            const leftHeight = leftColumn.offsetHeight;
            
            // Get right column elements above log terminal
            const rightColumnElements = rightColumn.children;
            let elementsHeight = 0;
            
            // Calculate height of all elements above log terminal
            for (let i = 0; i < rightColumnElements.length; i++) {
                const element = rightColumnElements[i];
                if (element.contains(logTerminal)) {
                    // This is the log section, calculate remaining height
                    const logSection = element;
                    const logHeader = logSection.querySelector('.h5');
                    
                    // Calculate available height for log terminal
                    // Account for flash controls that are now in right column
                    const availableHeight = leftHeight - elementsHeight - (logHeader ? logHeader.offsetHeight + 16 : 40) - 20; // 20px margin
                    
                    // Set minimum and maximum constraints (increased for better visibility)
                    const minHeight = 250;
                    const maxHeight = 600;
                    const finalHeight = Math.max(minHeight, Math.min(maxHeight, availableHeight));
                    
                    logTerminal.style.height = finalHeight + 'px';
                    break;
                } else {
                    // Add up heights of elements above log terminal (now includes flash controls)
                    elementsHeight += element.offsetHeight + 24; // 24px for mb-3 margin
                }
            }
        }
    } else {
        // Reset height for smaller screens
        const logTerminal = document.getElementById('log');
        if (logTerminal) {
            logTerminal.style.height = '';
        }
    }
}

function showFirmwareInfo(firmware) {
    const firmwareInfo = document.getElementById('firmwareInfo');
    const firmwareName = document.getElementById('firmwareName');
    const firmwareDescription = document.getElementById('firmwareDescription');
    const firmwareSize = document.getElementById('firmwareSize');
    const firmwareAddress = document.getElementById('firmwareAddress');
    const firmwareVersion = document.getElementById('firmwareVersion');
    
    const featuresSection = document.getElementById('firmwareFeaturesSection');
    const featuresList = document.getElementById('firmwareFeaturesList');

    const firmwareDetails = document.getElementById('firmwareDetails');
    // Hardware info elements
    const hardwareInfo = document.getElementById('hardwareInfo');
    const hardwareChip = document.getElementById('hardwareChip');
    const hardwareFlashSize = document.getElementById('hardwareFlashSize');
    const hardwareBoards = document.getElementById('hardwareBoards');
    const hardwarePower = document.getElementById('hardwarePower');
    const hardwareSpecialFeatures = document.getElementById('hardwareSpecialFeatures');
    const specialFeaturesList = document.getElementById('specialFeaturesList');
    
    if (!firmware) {
        firmwareInfo.classList.add('d-none');
        // Sync log height when firmware info is hidden
        setTimeout(() => {
            syncLogHeight();
        }, 100);
        return;
    }
    
    // Basic firmware info
    firmwareName.textContent = firmware.name;
    firmwareDescription.textContent = firmware.description;
    firmwareSize.textContent = firmware.size;
    firmwareAddress.textContent = firmware.flashAddress;
    firmwareVersion.textContent = `v${firmware.version}`;
    
    // Populate features
    if (firmware.features && firmware.features.length > 0) {
        featuresList.innerHTML = ''; // Clear previous list
        firmware.features.forEach(feature => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="bi bi-check-circle-fill text-success me-2" style="font-size: 0.8em;"></i>${feature}`;
            featuresList.appendChild(li);
        });
        featuresSection.classList.remove('d-none');
    } else {
        featuresSection.classList.add('d-none');
    }

    firmwareDetails.classList.remove('d-none');
    // Hardware info
    if (firmware.hardware_info) {
        const hwInfo = firmware.hardware_info;
        
        hardwareChip.textContent = hwInfo.chip || firmware.hardware_version || 'Unknown';
        hardwareFlashSize.textContent = hwInfo.flash_size || 'N/A';
        
        // Compatible boards
        if (hwInfo.compatible_boards && hwInfo.compatible_boards.length > 0) {
            hardwareBoards.textContent = hwInfo.compatible_boards.join(', ');
        } else {
            hardwareBoards.textContent = 'N/A';
        }
        
        // Power requirements
        hardwarePower.textContent = hwInfo.power_requirements || 'N/A';
        
        // Special features
        if (hwInfo.special_features && hwInfo.special_features.length > 0) {
            specialFeaturesList.textContent = hwInfo.special_features.join(', ');
            hardwareSpecialFeatures.classList.remove('d-none');
        } else {
            hardwareSpecialFeatures.classList.add('d-none');
        }
        
        hardwareInfo.classList.remove('d-none');
    } else {
        // If no hardware info, show basic hardware version if available
        if (firmware.hardware_version) {
            hardwareChip.textContent = firmware.hardware_version;
            hardwareFlashSize.textContent = 'N/A';
            hardwareBoards.textContent = 'N/A';
            hardwarePower.textContent = 'N/A';
            hardwareSpecialFeatures.classList.add('d-none');
            hardwareInfo.classList.remove('d-none');
        } else {
            hardwareInfo.classList.add('d-none');
        }
    }
    
    // Update flash address input
    flashAddressInput.value = firmware.flashAddress;
    
    // Trigger validation
    flashAddressInput.dispatchEvent(new Event('input'));
    
    firmwareInfo.classList.remove('d-none');
    
    // Sync log height after firmware info is displayed
    setTimeout(() => {
        syncLogHeight();
    }, 100); // Small delay to ensure DOM is updated
}

async function downloadFirmware(firmware) {
    try {
        log(`📥 Đang tải firmware: ${firmware.name}`);
        
        let url = firmware.path;
        let fallbackUrls = [];
        
        // Handle different path types and create fallback URLs
        if (url.startsWith('local://')) {
            // Local file path - remove local:// prefix and use relative path
            url = './' + url.replace('local://', '');
            // log(`📁 Đường dẫn local: ${url}`); // Ẩn log đường dẫn
        } else if (url.startsWith('http://') || url.startsWith('https://')) {
            
             //log(`🌐 Đường dẫn remote: ${url}`); // Ẩn log đường dẫn
            // Create fallback URLs for GitHub
            if (url.includes('github.com')) {
                if (url.includes('jsdelivr.net')) {
                    // If using jsdelivr, try raw GitHub as fallback
                    fallbackUrls.push(url.replace('https://cdn.jsdelivr.net/gh/', 'https://github.com/').replace('@master', '/raw/master'));
                } else if (url.includes('/raw/')) {
                    // If using raw, try jsdelivr as fallback
                    fallbackUrls.push(url.replace('https://github.com/', 'https://cdn.jsdelivr.net/gh/').replace('/raw/master', '@master'));
                } else if (url.includes('/blob/')) {
                    // Convert blob to raw and add jsdelivr fallback
                    const rawUrl = url.replace('/blob/', '/raw/');
                    fallbackUrls.push(rawUrl);
                    fallbackUrls.push(rawUrl.replace('https://github.com/', 'https://cdn.jsdelivr.net/gh/').replace('/raw/master', '@master'));
                }
            }
        } else {
            throw new Error('Định dạng đường dẫn không hợp lệ');
        }
        
        // Try main URL first, then fallbacks
        const urlsToTry = [url, ...fallbackUrls];
        let lastError = null;
        
        for (let i = 0; i < urlsToTry.length; i++) {
            const tryUrl = urlsToTry[i];
            try {
                log(`🔄 Đang thử tải xuống (lần ${i + 1}/${urlsToTry.length})...`);
                
                const response = await fetch(tryUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/octet-stream',
                    },
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const contentType = response.headers.get('content-type');
                log(`📋 Content-Type: ${contentType}`);
                
                const arrayBuffer = await response.arrayBuffer();
                
                if (arrayBuffer.byteLength === 0) {
                    throw new Error('File rỗng (0 bytes)');
                }
                
                const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                const file = new File([blob], firmware.filename, { type: 'application/octet-stream' });
                
                log(`✅ Đã tải thành công: ${firmware.filename} (${(arrayBuffer.byteLength / 1024).toFixed(1)}KB)`);
                
                return file;
                
            } catch (error) {
                lastError = error;
                log(`⚠️ Thất bại với URL ${i + 1}/${urlsToTry.length}: ${error.message}`);
                
                if (i < urlsToTry.length - 1) {
                    log(`🔄 Thử URL tiếp theo...`);
                }
            }
        }
        
        // All URLs failed
        throw lastError || new Error('Không thể tải firmware từ bất kỳ URL nào');
        
    } catch (error) {
        log(`❌ Lỗi tải firmware: ${error.message}`);
        
        // Detailed error logging
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            log(`💡 Gợi ý: Kiểm tra kết nối mạng hoặc CORS policy`);
        } else if (error.message.includes('404')) {
            log(`💡 Gợi ý: File không tồn tại trên server`);
        } else if (error.message.includes('403')) {
            log(`💡 Gợi ý: Không có quyền truy cập file`);
        }
        
        throw error;
    }
}

// Event Listeners
browseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0]);
});

// Drag & Drop
fileDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDrop.classList.add('dragover');
});

fileDrop.addEventListener('dragleave', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
});

fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// Flash address input validation
flashAddressInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    
    // Reset styles
    e.target.style.borderColor = '';
    e.target.style.backgroundColor = '';
    
    if (value === '') {
        e.target.style.borderColor = '#ef4444';
        return;
    }
    
    try {
        parseFlashAddress(value);
        // Valid address
        e.target.style.borderColor = '#10b981';
        e.target.style.backgroundColor = '#f0fdf4';
    } catch (error) {
        // Invalid address
        e.target.style.borderColor = '#ef4444';
        e.target.style.backgroundColor = '#fef2f2';
    }
});

// Add some common flash addresses as suggestions
flashAddressInput.addEventListener('focus', (e) => {
    if (!e.target.hasAttribute('data-initialized')) {
        e.target.setAttribute('data-initialized', 'true');
        e.target.setAttribute('title', 'Địa chỉ thông dụng:\n0x1000 - Bootloader\n0x8000 - Partition table\n0x10000 - Application (mặc định)\n0x110000 - OTA app partition');
    }
});

// Connection
connectBtn.addEventListener('click', async () => {
    try {
        log('Đang yêu cầu kết nối thiết bị...');
        if (device === null) {
            device = await serialLib.requestPort({});
            transport = new Transport(device, true);
        }

        const loaderOptions = {
            transport: transport,
            baudrate: consoleBaudRate,
            terminal: espLoaderTerminal,
            debugLogging: false,
        };

        espLoader = new ESPLoader(loaderOptions);
        chip = await espLoader.main();
        
        const chipName = espLoader.chip.CHIP_NAME || 'ESP32';
        log(`Kết nối thành công với ${chipName}`);
        
        // Read flash ID to get accurate flash size
        log('Đang đọc thông tin flash memory...');
        try {
            const flashId = await espLoader.readFlashId();
            log(`Flash ID: 0x${flashId.toString(16).padStart(6, '0').toUpperCase()}`);
            
            // Extract flash size from flash ID
            const flashSize = getFlashSizeFromId(flashId);
            
            updateConnectionStatus(true, `${chipName} (${flashSize})`);
        } catch (flashError) {
            log(`Không thể đọc flash ID: ${flashError.message}`);
            log('Sử dụng thông tin flash mặc định');
            updateConnectionStatus(true, `${chipName} (Flash: Unknown)`);
        }
        
        enableControls(true);
        
        // --- LOGIC LẤY MAC ĐÃ ĐƯỢC CHUYỂN VÀO espLoaderTerminal.writeLine ---
        // Đoạn code ở đây không còn cần thiết nữa.
    } catch (err) {
        log('Lỗi kết nối:', err.message);
        alert('Lỗi kết nối: ' + err.message);
        updateConnectionStatus(false);
        enableControls(false);
    }
});

// --- LOGIC LẤY MAC ĐÃ ĐƯỢC CHUYỂN VÀO HÀM CONNECT, NÚT NÀY KHÔNG CÒN CẦN THIẾT ---
// Bạn có thể xóa hoàn toàn đoạn code này hoặc giữ lại để tham khảo.
// getMacBtn.addEventListener('click', async () => { ... });

disconnectBtn.addEventListener('click', async () => {
    if (transport) await transport.disconnect();

    espLoader = null;
    device = null;
    transport = null;
    chip = null;
    
    // Xóa toàn bộ log
    logEl.textContent = 'ESP32 Web Flasher đã sẵn sàng';
    
    // Reset các trường liên quan đến MAC
    deviceMacAddressInput.value = '';
    macAddressDisplay.classList.add('d-none');
    copyMacBtn.classList.add('d-none');
    
    // Hiện lại link liên hệ HDN77
    if (contactHDN77Link) {
        contactHDN77Link.classList.remove('d-none');
    }
    
    // Reset password help về trạng thái ban đầu
    passwordHelp.textContent = 'Vui lòng kết nối thiết bị, để lấy địa chỉ MAC, sau đó nhập mật khẩu tương ứng.';
    passwordHelp.classList.remove('text-success', 'text-danger');
    
    // Bật lại các trường mật khẩu
    firmwarePasswordInput.disabled = false;
    firmwarePasswordInput.value = '';
    verifyPasswordBtn.disabled = false;
    
    // Ẩn danh sách firmware
    firmwareList.classList.add('d-none');
    firmwareList.value = '';
    
    // Ẩn thông tin firmware nếu đang hiển thị
    const firmwareInfo = document.getElementById('firmwareInfo');
    if (firmwareInfo) {
        firmwareInfo.classList.add('d-none');
    }
    
    // Reset file đã chọn
    selectedFile = null;
    fileName.textContent = '📁 Chưa chọn file';
    if (fileInput) {
        fileInput.value = '';
    }
    
    updateConnectionStatus(false);
    enableControls(false);
    setProgress(0);
    speedInfo.textContent = 'Tốc độ: --';
});

// Erase flash
eraseBtn.addEventListener('click', async () => {
    if (!espLoader) return alert('Chưa kết nối thiết bị');
    
    if (!confirm('Bạn có chắc muốn xóa toàn bộ flash memory?')) return;
    
    try {
        log('Bắt đầu xóa flash memory...');
        setProgress(0);
        
        await espLoader.eraseFlash();
        
        setProgress(100);
        log('Xóa flash thành công!');
        
    } catch (err) {
        log('Lỗi xóa flash:', err.message);
        alert('Lỗi: ' + err.message);
    }
});

// Flash firmware
flashBtn.addEventListener('click', async () => {
    if (!espLoader) return alert('Chưa kết nối thiết bị');
    if (!selectedFile) return alert('Chưa chọn file firmware');
    
    const flashStatusNotification = document.getElementById('flashStatusNotification');
    
    try {
        // Show flash status notification
        flashStatusNotification.classList.remove('d-none');
        
        log(`Bắt đầu nạp firmware: ${selectedFile.name}`);
        setProgress(0);
        startTime = Date.now();
        
        let fileData = await readUploadedFileAsBinaryString(selectedFile);
        log(`Đã đọc file: ${fileData.length} bytes`);
        
        // Parse flash address from input
        let flashAddress;
        try {
            flashAddress = parseFlashAddress(flashAddressInput.value);
            log(`Địa chỉ flash: ${flashAddressInput.value} (${flashAddress})`);
        } catch (error) {
            alert('Lỗi địa chỉ flash: ' + error.message);
            return;
        }

        const fileArray = [];
        fileArray.push({ data: fileData, address: flashAddress });

        const flashOptions = {
            fileArray: fileArray,
            flashSize: "keep",
            flashMode: undefined,  // Để esptool-js tự động detect mode phù hợp (QIO/DIO/DOUT)
            flashFreq: undefined,  // Để esptool-js tự động detect frequency (40MHz/80MHz)
            eraseAll: false,
            compress: true,
            reportProgress: (fileIndex, written, total) => {
                const progress = Math.round((written / total) * 100);
                setProgress(progress, written, total);
            },
            calculateMD5Hash: (image) => CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)),
        };
        log('⚠️ Bắt đầu ghi flash, vui lòng chờ đến khi có thông báo hoàn thành...');
        await espLoader.writeFlash(flashOptions);
        
        setProgress(100);
        
        // Hide flash status notification on success
        flashStatusNotification.classList.add('d-none');
        
        log('Nạp firmware thành công!');
        log('Bạn có thể reset ESP32 để chạy firmware mới');
        
        // Reset the device
        if (confirm('Nạp thành công! Bạn có muốn reset ESP32 không?')) {
            try {
                if (transport) {
                    await transport.disconnect();
                }
                await transport.connect(consoleBaudRate);
                await transport.setDTR(false);
                await new Promise(resolve => setTimeout(resolve, 100));
                await transport.setDTR(true);
                log('Đã reset ESP32');
                
                // Đợi một chút để ESP32 boot
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Tự động ngắt kết nối sau khi reset
                log('Đang ngắt kết nối...');
                await transport.disconnect();
                
                // Reset toàn bộ trạng thái như khi bấm nút ngắt kết nối
                espLoader = null;
                device = null;
                transport = null;
                chip = null;
                
                // Xóa toàn bộ log và hiển thị thông báo hoàn tất
                logEl.textContent = '✅ Nạp firmware và reset ESP32 thành công!\n\nESP32 Web Flasher đã sẵn sàng cho lần nạp tiếp theo.';
                
                // Reset các trường liên quan đến MAC
                deviceMacAddressInput.value = '';
                macAddressDisplay.classList.add('d-none');
                copyMacBtn.classList.add('d-none');
                
                // Hiện lại link liên hệ HDN77
                if (contactHDN77Link) {
                    contactHDN77Link.classList.remove('d-none');
                }
                
                // Reset password help về trạng thái ban đầu
                passwordHelp.textContent = 'Vui lòng kết nối thiết bị, để lấy địa chỉ MAC, sau đó nhập mật khẩu tương ứng.';
                passwordHelp.classList.remove('text-success', 'text-danger');
                
                // Bật lại các trường mật khẩu
                firmwarePasswordInput.disabled = false;
                firmwarePasswordInput.value = '';
                verifyPasswordBtn.disabled = false;
                
                // Ẩn danh sách firmware
                firmwareList.classList.add('d-none');
                firmwareList.value = '';
                
                // Ẩn thông tin firmware nếu đang hiển thị
                const firmwareInfo = document.getElementById('firmwareInfo');
                if (firmwareInfo) {
                    firmwareInfo.classList.add('d-none');
                }
                
                // Reset file đã chọn
                selectedFile = null;
                fileName.textContent = '📁 Chưa chọn file';
                if (fileInput) {
                    fileInput.value = '';
                }
                
                updateConnectionStatus(false);
                enableControls(false);
                setProgress(0);
                speedInfo.textContent = 'Tốc độ: --';
                
            } catch (resetErr) {
                log('Không thể reset tự động, vui lòng reset thủ công');
            }
        }
        
    } catch (err) {
        // Hide flash status notification on error
        flashStatusNotification.classList.add('d-none');
        
        log('Lỗi nạp firmware:', err.message);
        alert('Lỗi nạp firmware: ' + err.message);
    }
});

// Firmware selection from database
firmwareList.addEventListener('change', async (e) => {
    const selected = e.target.value;
    const selectedOption = e.target.options[e.target.selectedIndex];
    
    if (!selected) {
        showFirmwareInfo(null);
        return;
    }
    
    // Check if it's a fallback option (offline mode)
    if (selected.startsWith('sample')) {
        log(`Đang tải firmware mẫu (offline): ${selectedOption.textContent}`);
        
        // Create a sample firmware file for offline mode
        const sampleData = new Uint8Array(1024); // 1KB sample
        sampleData.fill(0xFF); // Fill with 0xFF (typical for flash)
        
        const blob = new Blob([sampleData], { type: 'application/octet-stream' });
        const file = new File([blob], `${selected}.bin`, { type: 'application/octet-stream' });
        
        handleFileSelect(file);
        
        // Reset selection
        e.target.value = '';
        return;
    }
    
    try {
        // Parse firmware data from dataset
        const firmware = JSON.parse(selectedOption.dataset.firmware);
        
        // Show firmware info
        showFirmwareInfo(firmware);
        
        // Download and select firmware
        const file = await downloadFirmware(firmware);
        handleFileSelect(file);
        
        // Keep firmware info visible after successful download
        // Reset only the selection dropdown
        setTimeout(() => {
            e.target.value = '';
            // Keep firmware info displayed - don't call showFirmwareInfo(null)
        }, 100);
        
    } catch (error) {
        alert(`Lỗi tải firmware: ${error.message}`);
        log(`❌ Chi tiết lỗi: ${error.stack || error.message}`);
        
        // Hide firmware info only on error
        setTimeout(() => {
            e.target.value = '';
            showFirmwareInfo(null);
        }, 100);
    }
});

// Sao chép địa chỉ MAC
copyMacBtn.addEventListener('click', () => {
    const macAddress = deviceMacAddressInput.value;
    if (macAddress) {
        navigator.clipboard.writeText(macAddress).then(() => {
            log(`✅ Đã sao chép địa chỉ MAC: ${macAddress}`);
            // Cung cấp phản hồi trực quan cho người dùng
            const originalIcon = copyMacBtn.innerHTML;
            copyMacBtn.innerHTML = '<i class="bi bi-clipboard-check-fill text-success me-1"></i>Đã sao chép';
            copyMacBtn.title = 'Đã sao chép!';
            setTimeout(() => {
                copyMacBtn.innerHTML = originalIcon;
                copyMacBtn.title = 'Sao chép địa chỉ MAC';
            }, 2000); // Reset sau 2 giây
        }).catch(err => {
            log(`❌ Lỗi sao chép địa chỉ MAC: ${err}`);
            alert('Không thể sao chép địa chỉ MAC. Vui lòng thử lại hoặc sao chép thủ công.');
        });
    }
});

// Clear log
clearLogBtn.addEventListener('click', () => {
    logEl.textContent = 'Log đã được xóa.';
});

// Clear firmware info
document.getElementById('clearFirmwareInfo').addEventListener('click', () => {
    showFirmwareInfo(null);
    log('Đã ẩn thông tin firmware');
});

// Open official tool
openOfficialBtn.addEventListener('click', () => {
    window.open('https://espressif.github.io/esptool-js/', '_blank');
});

// Create warning modal
function createWarningModal() {
    const modal = document.createElement('div');
    modal.className = 'warning-modal';
    modal.id = 'browserWarningModal';
    
    const currentBrowser = navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                          navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Safari' : 
                          navigator.userAgent.includes('Opera') ? 'Opera' :
                          'Trình duyệt không hỗ trợ';
    
    modal.innerHTML = `
        <div class="warning-content">
            <div class="warning-header">
                <div class="warning-icon">
                    <i class="bi bi-exclamation-triangle"></i>
                </div>
                <h2 class="warning-title">Cảnh báo trình duyệt</h2>
            </div>
            
            <div class="warning-message">
                <p>Trang web ESP32 Web Flasher cần sử dụng <strong>Web Serial API</strong> để kết nối với thiết bị ESP32. API này chỉ được hỗ trợ trên một số trình duyệt nhất định.</p>
            </div>
            
            <div class="warning-browsers">
                <h4><i class="bi bi-check-circle-fill"></i> Trình duyệt được hỗ trợ:</h4>
                <ul class="browser-list">
                    <li><strong>Google Chrome</strong> (khuyến nghị)</li>
                    <li><strong>Microsoft Edge</strong></li>
                </ul>
            </div>
            
            <div class="current-browser">
                <h4><i class="bi bi-x-circle-fill"></i> Trình duyệt hiện tại:</h4>
                <p><strong>${currentBrowser}</strong> - Không hỗ trợ Web Serial API</p>
            </div>
            
            <div class="warning-message">
                <p><i class="bi bi-info-circle"></i> Vui lòng mở trang này bằng <strong>Chrome</strong> hoặc <strong>Edge</strong> để sử dụng đầy đủ tính năng flash ESP32.</p>
            </div>
            
            <div class="warning-footer">
                <button class="warning-btn warning-btn-primary" onclick="closeWarningModal()">
                    <i class="bi bi-x-lg"></i> Đóng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
}

// Show warning modal
function showWarningModal() {
    const modal = document.getElementById('browserWarningModal') || createWarningModal();
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Close warning modal
function closeWarningModal() {
    const modal = document.getElementById('browserWarningModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Make functions global for onclick handlers
window.closeWarningModal = closeWarningModal;

// Browser compatibility check
function checkBrowserCompatibility() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    
    if (!isChrome && !isEdge) {
        // Show beautiful warning modal
        showWarningModal();const firmwareList = document.getElementById('firmwareList')
        
        // Also disable connect button
        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>Trình duyệt không hỗ trợ';
        connectBtn.title = 'Vui lòng sử dụng Chrome hoặc Edge';
        
        return false;
    }
    
    return true;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    log('ESP32 Web Flasher đã sẵn sàng');
    
    // Check browser compatibility first
    const isCompatible = checkBrowserCompatibility();
    
    if (isCompatible) {
        log('✅ Trình duyệt tương thích');
        log('Hãy kết nối ESP32 và chọn file firmware để bắt đầu');
    } else {
        log('❌ Trình duyệt không tương thích');
    }

    // Check if running from file:// protocol
    if (window.location.protocol === 'file:') {
        log('⚠️ Cảnh báo: Đang chạy từ file://');
        log('💡 Khuyến nghị: Sử dụng Live Server hoặc HTTP server để tránh lỗi CORS');
    }
    
    // Load public firmware database
    await loadPublicFirmwareDatabase();
    
    // Initial sync log height
    setTimeout(() => {
        syncLogHeight();
    }, 500);
});

// Window resize event listener to sync log height
window.addEventListener('resize', () => {
    // Debounce resize events
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
        syncLogHeight();
    }, 250);
});
