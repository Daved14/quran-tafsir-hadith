// ========================================================
// نظام مواقيت الصلاة الديناميكي الكامل (مُصحح)
// ========================================================

const PrayerApp = {
    // الإعدادات
    config: {
        method: parseInt(localStorage.getItem('calculationMethod')) || 4
    },
    
    // أسماء الصلوات
    prayerNames: {
        Fajr: 'الفجر',
        Sunrise: 'الشروق',
        Dhuhr: 'الظهر',
        Asr: 'العصر',
        Maghrib: 'المغرب',
        Isha: 'العشاء'
    },
    
    // ترتيب الصلوات
    prayerOrder: ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
    
    // المواقيت الحالية
    timings: null,
    
    // عداد الوقت
    countdownInterval: null,
    
    // ========== التهيئة ==========
    async init() {
        console.log('🚀 بدء تشغيل التطبيق...');
        
        // تحديث التاريخ الهجري أولاً
        await this.updateHijriDate();
        
        // الحصول على الموقع
        const location = await this.getLocation();
        
        if (location) {
            await this.fetchPrayerTimes(location.lat, location.lng);
            this.updateLocationDisplay(location);
        } else {
            // موقع افتراضي (مكة)
            await this.fetchPrayerTimes(21.4225, 39.8262);
            this.updateLocationDisplay({ city: 'مكة المكرمة', country: 'السعودية' });
        }
        
        // إخفاء التحميل
        this.hideLoading();
        
        // الاستماع لتغيير الموقع
        window.addEventListener('locationChanged', (e) => {
            const loc = e.detail;
            this.fetchPrayerTimes(loc.lat, loc.lng);
            this.updateLocationDisplay(loc);
        });
        
        // الاستماع لتغيير طريقة الحساب
        window.addEventListener('methodChanged', () => {
            this.config.method = parseInt(localStorage.getItem('calculationMethod')) || 4;
            const loc = JSON.parse(localStorage.getItem('userLocation'));
            if (loc) this.fetchPrayerTimes(loc.lat, loc.lng);
        });
    },
    
    // ========== التاريخ الهجري (مُصحح) ==========
    async updateHijriDate() {
        const hijriMonths = [
            'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
            'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
            'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
        ];
        
        // محاولة 1: استخدام Intl.DateTimeFormat
        try {
            const today = new Date();
            
            const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            
            const parts = formatter.formatToParts(today);
            
            let day = '--';
            let month = 'شعبان';
            let year = '1447';
            
            parts.forEach(part => {
                if (part.type === 'day') {
                    day = this.convertArabicNumbers(part.value).padStart(2, '0');
                }
                if (part.type === 'month') {
                    month = part.value;
                }
                if (part.type === 'year') {
                    year = this.convertArabicNumbers(part.value);
                }
            });
            
            // التحقق من صحة القيم
            if (day !== '--' && month) {
                document.getElementById('hijriDay').textContent = day;
                document.getElementById('hijriMonth').textContent = month;
                console.log('📅 التاريخ الهجري (Intl):', day, month, year);
                return;
            }
        } catch (e) {
            console.warn('Intl غير مدعوم، استخدام API...');
        }
        
        // محاولة 2: استخدام Aladhan API
        await this.fetchHijriDateFromAPI();
    },
    
    // تحويل الأرقام العربية للإنجليزية
    convertArabicNumbers(str) {
        const arabicNums = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
        return str.toString().replace(/[٠-٩]/g, d => arabicNums.indexOf(d));
    },
    
    // جلب التاريخ من API
    async fetchHijriDateFromAPI() {
        try {
            const today = new Date();
            const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
            
            const response = await fetch(`https://api.aladhan.com/v1/gToH/${dateStr}`);
            const data = await response.json();
            
            if (data.code === 200) {
                const hijri = data.data.hijri;
                
                const hijriDayEl = document.getElementById('hijriDay');
                const hijriMonthEl = document.getElementById('hijriMonth');
                
                if (hijriDayEl) hijriDayEl.textContent = hijri.day.padStart(2, '0');
                if (hijriMonthEl) hijriMonthEl.textContent = hijri.month.ar;
                
                console.log('📅 التاريخ الهجري (API):', hijri.day, hijri.month.ar, hijri.year);
            }
        } catch (e) {
            console.error('فشل جلب التاريخ من API:', e);
            // قيم افتراضية
            document.getElementById('hijriDay').textContent = '12';
            document.getElementById('hijriMonth').textContent = 'شعبان';
        }
    },
    
    // ========== جلب المواقيت من API ==========
    async fetchPrayerTimes(lat, lng) {
        try {
            const today = new Date();
            const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
            
            const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${this.config.method}`;
            
            console.log('🌐 جلب المواقيت...');
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.code === 200) {
                this.timings = data.data.timings;
                this.updateUI();
                console.log('✅ تم جلب المواقيت');
            }
        } catch (error) {
            console.error('❌ خطأ:', error);
        }
    },
    
    // ========== تحديث الواجهة ==========
    updateUI() {
        if (!this.timings) return;
        
        // تحديث أوقات الصلوات
        const ids = {
            fajrTime: 'Fajr',
            sunriseTime: 'Sunrise',
            dhuhrTime: 'Dhuhr',
            asrTime: 'Asr',
            maghribTime: 'Maghrib',
            ishaTime: 'Isha'
        };
        
        Object.entries(ids).forEach(([elementId, prayerKey]) => {
            const el = document.getElementById(elementId);
            if (el && this.timings[prayerKey]) {
                el.textContent = this.timings[prayerKey].substring(0, 5);
            }
        });
        
        // تحديث الصلاة القادمة
        this.updateNextPrayer();
    },
    
    // ========== تحديد الصلاة القادمة ==========
    updateNextPrayer() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        const toMinutes = (time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };
        
        let nextPrayer = null;
        let nextTime = null;
        let prevPrayer = null;
        let prevTime = null;
        
        // البحث عن الصلاة القادمة
        for (let i = 0; i < this.prayerOrder.length; i++) {
            const prayer = this.prayerOrder[i];
            const prayerMinutes = toMinutes(this.timings[prayer]);
            
            if (prayerMinutes > currentMinutes) {
                nextPrayer = prayer;
                nextTime = this.timings[prayer];
                break;
            }
            
            prevPrayer = prayer;
            prevTime = this.timings[prayer];
        }
        
        // إذا مرت كل الصلوات
        if (!nextPrayer) {
            nextPrayer = 'Fajr';
            nextTime = this.timings.Fajr;
            prevPrayer = 'Isha';
            prevTime = this.timings.Isha;
        }
        
        // تحديث البطاقة الرئيسية
        document.getElementById('currentPrayerName').textContent = this.prayerNames[nextPrayer];
        document.getElementById('currentPrayerTime').textContent = nextTime.substring(0, 5);
        
        // تمييز الصلوات
        this.highlightPrayers(nextPrayer);
        
        // بدء العد التنازلي
        this.startCountdown(nextTime, prevTime);
    },
    
    // ========== تمييز الصلوات ==========
    highlightPrayers(nextPrayer) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        const toMinutes = (time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };
        
        document.querySelectorAll('.prayer-item').forEach(item => {
            const prayer = item.dataset.prayer;
            const prayerKey = prayer.charAt(0).toUpperCase() + prayer.slice(1);
            const prayerMinutes = toMinutes(this.timings[prayerKey] || '00:00');
            
            item.classList.remove('active', 'passed');
            
            if (prayerKey === nextPrayer) {
                item.classList.add('active');
            } else if (prayerMinutes <= currentMinutes) {
                item.classList.add('passed');
            }
        });
    },
    
    // ========== العد التنازلي ==========
    startCountdown(nextTime, prevTime) {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        const updateCountdown = () => {
            const now = new Date();
            const [h, m] = nextTime.split(':').map(Number);
            
            const target = new Date();
            target.setHours(h, m, 0, 0);
            
            if (target <= now) {
                target.setDate(target.getDate() + 1);
            }
            
            const diff = target - now;
            
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            
            const countdownStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            document.getElementById('countdownTimer').textContent = countdownStr;
            
            // تحديث شريط التقدم
            this.updateProgress(prevTime, nextTime, now);
            
            // عند انتهاء العد
            if (diff <= 1000) {
                setTimeout(() => this.updateNextPrayer(), 1000);
            }
        };
        
        updateCountdown();
        this.countdownInterval = setInterval(updateCountdown, 1000);
    },
    
    // ========== شريط التقدم ==========
    updateProgress(prevTime, nextTime, now) {
        const toMinutes = (time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };
        
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        let prevMinutes = prevTime ? toMinutes(prevTime) : 0;
        let nextMinutes = toMinutes(nextTime);
        
        if (nextMinutes <= currentMinutes) {
            nextMinutes += 24 * 60;
        }
        
        if (prevMinutes >= nextMinutes) {
            prevMinutes -= 24 * 60;
        }
        
        const total = nextMinutes - prevMinutes;
        const elapsed = currentMinutes - prevMinutes;
        const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
        
        document.getElementById('progressFill').style.width = `${progress}%`;
    },
    
    // ========== الموقع ==========
    async getLocation() {
        // الموقع المحفوظ
        const saved = localStorage.getItem('userLocation');
        if (saved) {
            return JSON.parse(saved);
        }
        
        // GPS
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const location = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                    
                    // جلب اسم المدينة
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&accept-language=ar`
                        );
                        const data = await response.json();
                        location.city = data.address?.city || data.address?.town || data.address?.village || '';
                        location.country = data.address?.country || '';
                    } catch (e) {}
                    
                    localStorage.setItem('userLocation', JSON.stringify(location));
                    resolve(location);
                },
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    },
    
    // ========== عرض الموقع ==========
    updateLocationDisplay(location) {
        const text = document.getElementById('locationText');
        const coords = document.getElementById('locationCoords');
        
        if (text) {
            text.textContent = `${location.city || 'غير معروف'}${location.country ? ' - ' + location.country : ''}`;
        }
        
        if (coords && location.lat) {
            coords.textContent = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
        }
    },
    
    // ========== إخفاء التحميل ==========
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
};

// تشغيل التطبيق
document.addEventListener('DOMContentLoaded', () => {
    PrayerApp.init();
});

// ========================================
// ⭐ ربط أوقات الصلاة مع نظام الأذان
// ========================================

// بعد جلب أوقات الصلاة وعرضها، أرسل البيانات لنظام الأذان
function syncWithAdhanSystem(prayerTimes) {
    // تنسيق البيانات
    const formattedTimes = {
        fajr: prayerTimes.Fajr || prayerTimes.fajr,
        sunrise: prayerTimes.Sunrise || prayerTimes.sunrise,
        dhuhr: prayerTimes.Dhuhr || prayerTimes.dhuhr,
        asr: prayerTimes.Asr || prayerTimes.asr,
        maghrib: prayerTimes.Maghrib || prayerTimes.maghrib,
        isha: prayerTimes.Isha || prayerTimes.isha
    };
    
    // حفظ في localStorage
    localStorage.setItem('prayerTimes', JSON.stringify(formattedTimes));
    
    // تحديث نظام الأذان إذا كان موجوداً
    if (typeof updateAdhanSystemTimes === 'function') {
        updateAdhanSystemTimes(formattedTimes);
    }
    
    console.log('✅ تم مزامنة أوقات الصلاة مع نظام الأذان');
}

// استدعِ هذه الدالة بعد تحميل أوقات الصلاة
 syncWithAdhanSystem(prayerTimesData);