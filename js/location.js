// ========================================================
// نظام تحديد الموقع بالخريطة
// ========================================================

const LocationPicker = {
    map: null,
    marker: null,
    position: null,
    cityName: '',
    countryName: '',
    
    // ========== التهيئة ==========
    init() {
        console.log('🗺️ تهيئة الخريطة...');
        
        // إنشاء الخريطة
        this.map = L.map('map').setView([21.4225, 39.8262], 6);
        
        // إضافة طبقة الخريطة
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.map);
        
        // تحميل الموقع المحفوظ
        this.loadSavedLocation();
        
        // الأحداث
        this.setupEvents();
    },
    
    // ========== تحميل الموقع المحفوظ ==========
    loadSavedLocation() {
        const saved = localStorage.getItem('userLocation');
        if (saved) {
            const loc = JSON.parse(saved);
            this.setPosition(loc.lat, loc.lng);
            this.cityName = loc.city || '';
            this.countryName = loc.country || '';
            this.map.setView([loc.lat, loc.lng], 12);
        }
    },
    
    // ========== إعداد الأحداث ==========
    setupEvents() {
        // النقر على الخريطة
        this.map.on('click', (e) => {
            this.setPosition(e.latlng.lat, e.latlng.lng);
            this.reverseGeocode(e.latlng.lat, e.latlng.lng);
        });
        
        // زر تحديد الموقع
        document.getElementById('locateBtn').addEventListener('click', () => {
            this.getCurrentLocation();
        });
        
        // زر الحفظ
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveLocation();
        });
    },
    
    // ========== وضع العلامة ==========
    setPosition(lat, lng) {
        this.position = [lat, lng];
        
        // إزالة العلامة القديمة
        if (this.marker) {
            this.map.removeLayer(this.marker);
        }
        
        // إنشاء أيقونة مخصصة
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background: #d4af37;
                width: 24px;
                height: 24px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        });
        
        // إضافة العلامة الجديدة
        this.marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.map);
        
        // تفعيل زر الحفظ
        document.getElementById('saveBtn').disabled = false;
        
        // تحديث العرض
        this.updateInfoPanel();
    },
    
    // ========== تحديد الموقع GPS ==========
    getCurrentLocation() {
        const btn = document.getElementById('locateBtn');
        btn.classList.add('loading');
        
        this.hideError();
        
        if (!navigator.geolocation) {
            this.showError('المتصفح لا يدعم تحديد الموقع');
            btn.classList.remove('loading');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                this.setPosition(lat, lng);
                this.reverseGeocode(lat, lng);
                this.map.setView([lat, lng], 14);
                
                btn.classList.remove('loading');
            },
            (err) => {
                let message = 'حدث خطأ في تحديد الموقع';
                
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        message = 'تم رفض إذن تحديد الموقع';
                        break;
                    case err.POSITION_UNAVAILABLE:
                        message = 'لا يمكن تحديد الموقع حالياً';
                        break;
                    case err.TIMEOUT:
                        message = 'انتهت مهلة تحديد الموقع';
                        break;
                }
                
                this.showError(message);
                btn.classList.remove('loading');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    },
    
    // ========== تحويل الإحداثيات لاسم ==========
    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`
            );
            const data = await response.json();
            
            this.cityName = data.address?.city || data.address?.town || data.address?.village || data.address?.state || '';
            this.countryName = data.address?.country || '';
            
            this.updateInfoPanel();
        } catch (e) {
            console.error('خطأ في Geocoding:', e);
        }
    },
    
    // ========== تحديث لوحة المعلومات ==========
    updateInfoPanel() {
        const infoDiv = document.getElementById('locationInfo');
        
        if (this.position) {
            infoDiv.innerHTML = `
                <div class="location-info-panel">
                    <div class="icon-wrapper">
                        <i data-lucide="map-pin"></i>
                    </div>
                    <div class="location-details">
                        <h4>${this.cityName || 'جارٍ تحديد المدينة...'}${this.countryName ? ' - ' + this.countryName : ''}</h4>
                        <p>${this.position[0].toFixed(4)}, ${this.position[1].toFixed(4)}</p>
                    </div>
                </div>
            `;
            
            // إعادة تحميل الأيقونات
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },
    
    // ========== حفظ الموقع ==========
    async saveLocation() {
        if (!this.position) return;
        
        const btn = document.getElementById('saveBtn');
        btn.disabled = true;
        btn.innerHTML = '<span>جارٍ الحفظ...</span>';
        
        // إذا لم يتم جلب اسم المدينة بعد
        if (!this.cityName) {
            await this.reverseGeocode(this.position[0], this.position[1]);
        }
        
        // جلب المنطقة الزمنية
        let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        try {
            const tzResponse = await fetch(
                `https://api.aladhan.com/v1/timezone/${this.position[0]}/${this.position[1]}`
            );
            const tzData = await tzResponse.json();
            if (tzData.data) timezone = tzData.data;
        } catch (e) {}
        
        // حفظ البيانات
        const locationData = {
            lat: this.position[0],
            lng: this.position[1],
            city: this.cityName,
            country: this.countryName,
            timezone: timezone
        };
        
        localStorage.setItem('userLocation', JSON.stringify(locationData));
        
        // إرسال حدث تغيير الموقع
        window.dispatchEvent(new CustomEvent('locationChanged', { detail: locationData }));
        
        // الرجوع للصفحة السابقة
        window.location.href = 'index.html';
    },
    
    // ========== عرض/إخفاء الأخطاء ==========
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    },
    
    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }
};

// تشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    LocationPicker.init();
});