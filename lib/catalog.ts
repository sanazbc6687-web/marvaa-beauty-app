import { Service, WizardQuestion } from "./types";

// Database fallback used by the demo when Supabase environment variables are absent.
export const services: Service[] = [
  { id:"hair-color", title:"رنگ مو", description:"رنگ‌ها و تناژهای مختلف رو روی خودت ببین.", icon:"sparkles", enabled:true },
  { id:"haircut", title:"کوتاهی مو", description:"قبل از کوتاهی، فرم تازه موهات رو امتحان کن.", icon:"scissors", enabled:true },
  { id:"brows", title:"ابرو", description:"مدلی هماهنگ با فرم صورتت پیدا کن.", icon:"scan-face", enabled:true },
  { id:"lashes", title:"مژه", description:"حالت و حجم مناسب چشم‌هات رو مقایسه کن.", icon:"eye", enabled:true },
  { id:"updo", title:"شینیون", description:"استایل مناسب مراسمت رو انتخاب کن.", icon:"flower", enabled:true },
  { id:"nails", title:"ناخن", description:"رنگ و فرم تازه رو قبل از اجرا ببین.", icon:"hand", enabled:true }
];
const generic: WizardQuestion[] = [{ id:"style", question:"کدوم مدل بیشتر به چیزی که تو ذهنت هست نزدیکه؟", options:["طبیعی و مینیمال","کلاسیک","مدرن و مشخص"] }, { id:"change", question:"دوست داری تغییرت چقدر دیده بشه؟", options:["طبیعی","متوسط","جسورانه"] }];
export const selfQuestions: Record<string, WizardQuestion[]> = {
  "hair-color":[{id:"tone",question:"چه تناژی دوست داری؟",options:["گرم","سرد","خنثی","مطمئن نیستم"]},{id:"family",question:"کدوم خانواده رنگ به چیزی که تو ذهنت هست نزدیکه؟",options:["کاراملی","شکلاتی","عسلی","بژ","صدفی","یخی","کرم","مسی","قهوه‌ای طبیعی"]},{id:"technique",question:"چه تکنیکی دوست داری؟",options:["رنگ یکدست","آمبره","بالیاژ","بالیاژ برزیلی","آمبره روسی","هایلایت","لولایت"]},{id:"change",question:"دوست داری تغییرت طبیعی باشه یا یکم جسورانه‌تر؟",options:["طبیعی","متوسط","جسورانه"]}],
  haircut:[{id:"cut",question:"کدوم فرم کوتاهی رو دوست داری؟",options:["Bob Graduation","باب شیب‌دار","Shaggy","Layer","تا روی شانه","تا روی کت"]},...generic],
  brows:[{id:"brow",question:"کدوم سبک ابرو رو بیشتر می‌پسندی؟",options:["میکرو با دستگاه به سبک کره‌ای","میکرو با قلم مویی طبیعی"]},...generic],
  lashes:[{id:"lash",question:"کدوم حالت مژه نزدیک‌تر به سلیقه‌ته؟",options:["Spiky","Volume","Mega Volume","L Curl","Cat Eye"]},...generic],
  updo:[{id:"updo",question:"موهات رو چطور تصور می‌کنی؟",options:["بالا","وسط","پایین","موی جمع","باز","نیمه‌باز"]},...generic], nails:generic
};
export const consultQuestions: WizardQuestion[] = [{id:"skin",question:"تناژ پوستت رو چطور توصیف می‌کنی؟",hint:"مطمئن نیستی؟ ببین معمولاً طلا بیشتر بهت میاد یا نقره.",options:["گرم؛ طلا بیشتر بهم میاد","سرد؛ نقره بیشتر بهم میاد","خنثی","مطمئن نیستم"]},{id:"current",question:"ظاهر فعلی‌ت بیشتر به کدوم نزدیکه؟",options:["روشن","متوسط","تیره","ترجیح می‌دم از روی عکس ببینی"]},{id:"change",question:"از این تغییر چه حسی می‌خوای؟",options:["خیلی طبیعی و کم‌ریسک","تازه اما متعادل","متفاوت و جسورانه"]},{id:"care",question:"چقدر برای نگهداری و ترمیمش وقت می‌ذاری؟",options:["خیلی کم","ماهانه اوکیه","هرچقدر برای نتیجه خوب لازم باشه"]}];
