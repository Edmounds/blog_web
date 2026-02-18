export interface StaticBlogPost {
  slug: string;
  title: string;
  summary: string;
  cover: string;
  category: string;
  dateLabel: string;
  dateLong: string;
  readingTime: string;
  archiveYear?: number;
  archiveTags?: string[];
  archiveExcerpt?: string;
  showOnHome: boolean;
  showInArchive: boolean;
}

export const staticBlogPosts: StaticBlogPost[] = [
  {
    slug: "designing-for-clarity-in-chaos",
    title: "Designing for Clarity in Chaos",
    summary:
      "In a world overflowing with information, the role of a designer shifts from creator to curator. How do we build interfaces that calm the mind?",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAhMws6Shyuk4QRp4NaKBuoYExU7aafn8AOJ0LbQ_eAL-pjpFHfwhDXl5TpJmTXuPRuSMEdMHueIoiFBbGeyP0a-8iIVC-b0fo1NNj13re8OVxgRtOVo7UscYyE7Han2bXFi9AGmzmLpqrIBPVc9yv4a3d7AR2uNWOtnbhNX81IFbqhNs2NjX1skjzZ2Vn-5Hi8vHeHQT5Wv_YB9uMWF4Yg2ik257F5b0Y4SGaEZ7J6nbGggjr_F3EIZ3QtvMHrzxYJKHojXlC-1MuT",
    category: "Design",
    dateLabel: "Oct 28",
    dateLong: "October 28, 2024",
    readingTime: "8 min",
    showOnHome: true,
    showInArchive: false,
  },
  {
    slug: "future-of-interface",
    title: "The Future of Interface",
    summary:
      "Screens are disappearing. Voice, gesture, and thought are becoming the new keyboard. What does this mean for visual design?",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDQQzbaUSpDNY3zpF6TB-UoePhXJsppfGae1qeSQ1VXcKBakqLaOgq2nkvDymHIgOmmzr1ysejsKUOIseAg0YRquHvtNteq4bl4AeucI0mFQIQLeFmpDFAk1SUtYMJr8sI55ie6n3Rwv-NN3yxKfzI_bc5j3mtJfNT0wyDU0noc4MYfKB6Tg35ULCIYdhsJcFeg0LdReJg9JMKXg__j7KTi1PaNxekH9YLmg3TQsey-np4M_MFu3yEd2vvmNUWdLAPDkGR3FXmJvAQN",
    category: "Technology",
    dateLabel: "Oct 15",
    dateLong: "October 15, 2024",
    readingTime: "4 min",
    showOnHome: true,
    showInArchive: false,
  },
  {
    slug: "digital-minimalism-in-2024",
    title: "Digital Minimalism in 2024",
    summary:
      "Revisiting Cal Newport's thesis in the age of algorithmic feeds. Can we truly disconnect without losing relevance?",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA9hkORmimTo5FBmvlajpgwKNMDpYzSeAZOKcVLN2Fi1yhrCJNEBDdRi6_1jE1J14gfwsEu2fOq89czGsgGWTIDLlYnXitUsAUBldfsJ6Pz5fCX3pLoZfg272AuxE6nlLDpXOSaonTdmnPfWf23QKKis0L4eXYM6FEIFoeFFnTaagqdNZN7RJmWX5fox-8IIYEaxMIg9dU-4kWYhnrc9XvMTlvLtq4YcB474dr4ypemdTW9eTmWTMAn_dq16WdzUkZwHemtUSB4lzTS",
    category: "Reflection",
    dateLabel: "Sep 22",
    dateLong: "September 22, 2024",
    readingTime: "6 min",
    showOnHome: true,
    showInArchive: false,
  },
  {
    slug: "future-of-interfaces-is-invisible",
    title: "The Future of Interfaces is Invisible",
    summary:
      "As AI agents become more capable, the traditional GUI will slowly fade away, replaced by intent-based interactions that don't require buttons.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAVDyIUSAKfpRx3TOnI67ShDIW4HSnsFxwLiP40Df8kXsAYNRWAKHKFUgmNAIQos6Zipp0BJ3bKT4YrVqDL0hA22O29wb-Zm_MT82HFNDudNh8UC7H8WmAu4jTAOgcon_pUEy8auXavhC2L0xn6mtOMh0B1HEwgTVH-7l91C4b0bXtRCvZK099fBUWYFkKtnH5NtbkHgKVxsOFe1z8DKw5ALQAt9RGVB218vM-b22SsrEIKI67MSXLubE25KCi_KV6-7_zMvPjtnZNR",
    category: "Design",
    dateLabel: "Oct 12",
    dateLong: "October 12, 2024",
    readingTime: "5 min",
    archiveYear: 2024,
    archiveTags: ["Design", "AI"],
    archiveExcerpt:
      "As AI agents become more capable, the traditional GUI will slowly fade away, replaced by intent-based interactions that don't require buttons.",
    showOnHome: false,
    showInArchive: true,
  },
  {
    slug: "revisiting-the-modern-stack",
    title: "Revisiting the Modern Stack",
    summary: "Complexity has crept into web development.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuASgy_rtDSPG0eIbnc-3D53CCSqilaRTwBZrUTvhm8mFT6OMEr9TamWbs_J7_AJGLRQw3Do-Lo-oHtm07HMbXTA1seWqjYJht_vr1kJfgizZmO5RXJrfHbB_u5TkE-US0ld7Ps3l6RfiiOAjrZYgEmh6r-ztd-uejt55IQUDtaokq12upFX0vaE0uy9Wxy2JggvaiwV-qSBYo2mX0LWROhwweqEBfQjTz49a_gWelXW8mtzzuoJAnu8yFFldxTw707zb31hudPQ6waX",
    category: "Engineering",
    dateLabel: "Sep 04",
    dateLong: "September 4, 2024",
    readingTime: "5 min",
    archiveYear: 2024,
    archiveTags: ["Engineering"],
    archiveExcerpt:
      "Complexity has crept into web development. It's time to simplify our tools and return to the fundamentals that make the web great.",
    showOnHome: false,
    showInArchive: true,
  },
  {
    slug: "designing-for-trust",
    title: "Designing for Trust",
    summary:
      "How transparency in data handling can be the biggest differentiator for products in the age of algorithmic feeds.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC2zXeOoRCjDf49DtFzbCBYs4qBGCS-jOPrNi3Cg1TuartdrJNWGvbPm1VarUzv9c-otFlvOhvxKo_HCnHpPq1q9YHQ3UE15Ha8by8dHrQJ62hK_JtIAR-_OAYJjIOo5ZCglxxuL1karGnmjcXF-_sGeKl0BIZutpicaqYgwANg6M7hD5coNTmMwzTZ57JKmpORrOKG0kcK6j805vyU7ZD5dPLKWImAF1LcO1xO6ADmw3zQMnGnuQGemXQvtoIMAkUPUm7vO7vw4-LK",
    category: "Ethics",
    dateLabel: "Aug 18",
    dateLong: "August 18, 2024",
    readingTime: "5 min",
    archiveYear: 2024,
    archiveTags: ["Ethics", "Product"],
    archiveExcerpt:
      "How transparency in data handling can be the biggest differentiator for products in the age of algorithmic feeds.",
    showOnHome: false,
    showInArchive: true,
  },
  {
    slug: "digital-gardens-vs-streams",
    title: "Digital Gardens vs Streams",
    summary:
      "Why tending to a collection of evergreen notes is more fulfilling than feeding the social media algorithm.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBoeeUxuyVnzBtVmdouxKW6av2OW6kqMHoVE4S--MNrqy3y11-GgqaF6DwWPoe28sr0jSeLXfh8Wthf4UWbtyaaOneP1GomwuDdCpHlme5fcuCp67PruZdcHMmPbhdQlgrY3dyTnR5JNsBrygXfe8zJuulY8B-n0ja9JOb2ctdQocu_1NNFLRktDrxu0re-PnGNGLKHKJ6IIDu_LxIrbmKE24nruyMrsqofPOOTEzuCxo1NIguBeXDtw4c8iOL4n3EWbMRh_f9GQFbY",
    category: "Philosophy",
    dateLabel: "Nov 21",
    dateLong: "November 21, 2023",
    readingTime: "5 min",
    archiveYear: 2023,
    archiveTags: ["Philosophy"],
    archiveExcerpt:
      "Why tending to a collection of evergreen notes is more fulfilling than feeding the social media algorithm.",
    showOnHome: false,
    showInArchive: true,
  },
  {
    slug: "color-theory-for-developers",
    title: "Color Theory for Developers",
    summary: "A compact walkthrough of contrast, hierarchy, and intentional palette choices.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD1qZp0TVBL83jro2Vm_4yltm_l6BfxFJMe1mhdUjsLz9dQiLcX-CHr4MdHqurfYWEc3lBYQ50EBj0PzCzuOqnHh_blEHCD-g3Wy6TUNCFgo02P5CNy-Se3ivSMmxF3W7-sWBBe8oZd2BB-E6nPrGPwZX9Cyqyz7W7D2Lu5G-4MhHU0GK_iOHcSRL5wOraVfZj0ZOTQnuPzoDmwPleaNyY-Ix9AD7qmqnKi7InmdoPgrVbo3XxJjrXH0dKeMAsMak-XxD5eqGbwYDdm",
    category: "Tutorial",
    dateLabel: "Jun 10",
    dateLong: "June 10, 2023",
    readingTime: "5 min",
    archiveYear: 2023,
    archiveTags: ["Tutorial"],
    showOnHome: false,
    showInArchive: true,
  },
  {
    slug: "minimalist-manifesto",
    title: "A Minimalist Manifesto",
    summary: "Notes on subtraction, constraints, and intentional digital environments.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD9WO7PN2Mvv02IHSbOyGlrsL3SroCfW0ZiGTBA6-7--xR60ilpf9xKXpRiG3e1TI3DIH0swMDqXRCdbJtHoiOR-WmO9EDw84_PEPuhk6r5QNTzXMb2HSdaXPX0EVhaUslavJ-EeY6rmFOpMI9_Q3ADMBnTq0HW17xrXYB3jSIyP6ybFIBYUHI9RDUMh4fGtKPnPrfKmdCGKY7NxJ60XF3IHqtavx6n-T3eJNJ3s2QdDoS1EPqihTe_peev5uDOgrfN99sW8jo_Motl",
    category: "Lifestyle",
    dateLabel: "Feb 02",
    dateLong: "February 2, 2023",
    readingTime: "5 min",
    archiveYear: 2023,
    archiveTags: ["Lifestyle"],
    showOnHome: false,
    showInArchive: true,
  },
];

export const homeBlogPosts = staticBlogPosts.filter((post) => post.showOnHome);

export const archiveBlogSections = [2024, 2023].map((year) => ({
  year,
  posts: staticBlogPosts.filter((post) => post.showInArchive && post.archiveYear === year),
}));

export const blogBySlug = new Map(staticBlogPosts.map((post) => [post.slug, post]));

export const archiveCategoryFilters = [
  { label: "All Categories", count: 42 },
  { label: "Design", count: 12 },
  { label: "Engineering", count: 8 },
  { label: "Philosophy", count: 15 },
  { label: "AI", count: 7 },
  { label: "Tutorials", count: 5 },
];
