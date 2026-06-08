import React, { createContext, useContext, useState } from 'react'

const translations = {
  en: {
    login: 'Login', logout: 'Logout', username: 'Username', password: 'Password',
    dashboard: 'Dashboard', staff: 'Staff', guards: 'Guards', admins: 'Admins',
    visitors: 'Temporary Users', cameras: 'Gate Cameras', logs: 'System Logs',
    notifications: 'Notifications', settings: 'Settings',
    addNew: 'Add New', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
    search: 'Search…', filter: 'Filter', export: 'Export',
    firstName: 'First Name', middleName: 'Middle Name', lastName: 'Last Name',
    phone: 'Phone', email: 'Email', gender: 'Gender', position: 'Position',
    department: 'Department', digitalId: 'Digital ID',
    welcome: 'Welcome back', role: 'Role',
    corpName: 'Amhara Media Corporation',
    accessControlSystem: 'Access Control System',
    scanFace: 'Scan Face', capturing: 'Capturing…', processing: 'Processing…',
    accepted: 'Access Granted', rejected: 'Access Denied',
    spoofDetected: 'Spoof Detected', attemptLimit: 'Attempt Limit Reached',
    approved: 'Approved', denied: 'Denied', pending: 'Pending',
    request: 'Request', approve: 'Approve', deny: 'Deny',
    reason: 'Reason', startDate: 'Start Date', endDate: 'End Date',
    gateName: 'Gate Name', cameraName: 'Camera Name', terminalId: 'Terminal ID',
    power: 'Power', status: 'Status', on: 'On', off: 'Off',
    active: 'Active', maintenance: 'On Maintenance',
    totalStaff: 'Total Staff', totalGuards: 'Total Guards',
    totalVisitors: 'Total Visitors', totalCameras: 'Total Cameras',
    registeredToday: 'Registered Today', accessLogs: 'Access Logs',
    noData: 'No data available', loading: 'Loading…',
    confirmDelete: 'Are you sure you want to delete this record?',
    male: 'Male', female: 'Female', other: 'Other',
    faceCapture: 'Face Capture', idCapture: 'ID Card Capture',
    front: 'Front', left: 'Left', right: 'Right', down: 'Down', unusual: 'Unusual',
    idFront: 'ID Front', idBack: 'ID Back',
    visitorRequest: 'Visitor Request', myRequests: 'My Requests',
    denialReason: 'Denial Reason',
    profileImage: 'Profile Image', capture: 'Capture', recapture: 'Recapture',
    registerVisitor: 'Register Visitor', registerStaff: 'Register Staff',
    registerGuard: 'Register Guard', registerAdmin: 'Register Admin',
    allRoles: 'All Roles', today: 'Today', thisWeek: 'This Week', thisMonth: 'This Month',
    confidence: 'Confidence', timestamp: 'Time', action: 'Action',
    unknown: 'Unknown', scanResult: 'Scan Result',
    assignedGate: 'Assigned Gate', description: 'Description', tag: 'Tag',
  },
  am: {
    login: 'ግባ', logout: 'ውጣ', username: 'የተጠቃሚ ስም', password: 'የሚስጥር ቃል',
    dashboard: 'ዳሽቦርድ', staff: 'ሠራተኞች', guards: 'ጠባቂዎች', admins: 'አስተዳዳሪዎች',
    visitors: 'ጊዜያዊ ተጠቃሚዎች', cameras: 'የበር ካሜራዎች', logs: 'ምዝግብ ማስታወሻ',
    notifications: 'ማሳወቂያዎች', settings: 'ቅንብሮች',
    addNew: 'አዲስ ጨምር', edit: 'አርትዕ', delete: 'ሰርዝ', save: 'አስቀምጥ', cancel: 'ሰርዝ',
    search: 'ፈልግ…', filter: 'አጣራ', export: 'ላክ',
    firstName: 'ስም', middleName: 'የአባት ስም', lastName: 'የአያት ስም',
    phone: 'ስልክ', email: 'ኢሜይል', gender: 'ጾታ', position: 'ቦታ',
    department: 'ክፍል', digitalId: 'ዲጂታል መለያ',
    welcome: 'እንኳን ደህና መጡ', role: 'ሚና',
    corpName: 'የአማራ ሚዲያ ኮርፖሬሽን',
    accessControlSystem: 'የመቆጣጠሪያ ስርዓት',
    scanFace: 'ፊት ቃኝ', capturing: 'በማነሳ ላይ…', processing: 'በማካሄድ ላይ…',
    accepted: 'ፍቃድ ተሰጠ', rejected: 'ፍቃድ ተከለከለ',
    spoofDetected: 'ማጭበርበር ተገኝቷል', attemptLimit: 'የሙከራ ወሰን ደረሰ',
    approved: 'ጸደቀ', denied: 'ተከለከለ', pending: 'በመጠባበቅ ላይ',
    request: 'ጥያቄ', approve: 'ፍቀድ', deny: 'ከለክል',
    reason: 'ምክንያት', startDate: 'መጀመሪያ ቀን', endDate: 'መጨረሻ ቀን',
    gateName: 'የበር ስም', cameraName: 'የካሜራ ስም', terminalId: 'ተርሚናል መለያ',
    power: 'ኃይል', status: 'ሁኔታ', on: 'ብቃት', off: 'ዝቅተኛ',
    active: 'ንቁ', maintenance: 'በጥገና ላይ',
    totalStaff: 'ጠቅላላ ሠራተኞች', totalGuards: 'ጠቅላላ ጠባቂዎች',
    totalVisitors: 'ጠቅላላ ጎብኝዎች', totalCameras: 'ጠቅላላ ካሜራዎች',
    registeredToday: 'ዛሬ የተመዘገቡ', accessLogs: 'ምዝግብ ማስታወሻ',
    noData: 'ምንም ውሂብ የለም', loading: 'በመጫን ላይ…',
    confirmDelete: 'ይህን መዝገብ ለመሰረዝ እርግጠኛ ነዎት?',
    male: 'ወንድ', female: 'ሴት', other: 'ሌላ',
    faceCapture: 'የፊት ምስል', idCapture: 'የመታወቂያ ምስል',
    front: 'ፊት', left: 'ግራ', right: 'ቀኝ', down: 'ታች', unusual: 'ያልተለመደ',
    idFront: 'መታወቂያ ፊት', idBack: 'መታወቂያ ኋላ',
    visitorRequest: 'የጎብኚ ጥያቄ', myRequests: 'የኔ ጥያቄዎች',
    denialReason: 'የመከልከል ምክንያት',
    profileImage: 'የፕሮፋይል ምስል', capture: 'ቃኝ', recapture: 'እንደገና ቃኝ',
    registerVisitor: 'ጎብኚ ምዝገባ', registerStaff: 'ሠራተኛ ምዝገባ',
    registerGuard: 'ጠባቂ ምዝገባ', registerAdmin: 'አስተዳዳሪ ምዝገባ',
    allRoles: 'ሁሉም ሚናዎች', today: 'ዛሬ', thisWeek: 'ይህ ሳምንት', thisMonth: 'ይህ ወር',
    confidence: 'እምነት', timestamp: 'ጊዜ', action: 'ድርጊት',
    unknown: 'ያልታወቀ', scanResult: 'የቃኝ ውጤት',
    assignedGate: 'የተመደበ በር', description: 'መግለጫ', tag: 'መለያ',
  },
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ameco_lang') || 'en')

  const switchLang = (l) => {
    setLang(l)
    localStorage.setItem('ameco_lang', l)
  }

  const t = (key) => translations[lang][key] || translations['en'][key] || key

  return (
    <LanguageContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => useContext(LanguageContext)