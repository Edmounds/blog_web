export interface TimelineProject {
  id: string;
  title: string;
  year: string;
  category: string;
  summary: string;
  cover: string;
  side: "left" | "right";
}

export interface HomeProject {
  id: string;
  title: string;
  category: string;
  type: string;
  summary: string;
  cover: string;
  cta: string;
}

export const timelineProjects: TimelineProject[] = [
  {
    id: "nexus-dashboard",
    title: "Nexus Dashboard",
    year: "2024",
    category: "Fintech",
    summary:
      "Redefining complexity through a minimalist financial interface that prioritizes data clarity and user intuition.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCzhHcIvNnzJbT_zQ5n5Bdi7_Dwg7rzXRHHZ-v82uXLoF-4gzqQBAakYPXh7Wh0koUdg4GjidBptfg0nmI0qSOwDIwkf2CZsiv_N1VAvaHwhAbfZftxW4unqOI9qVLb7y1N-_BMwO320peeblVJymMl91tYArWJcdf5duZcvbenqPk9P6bA-9JtpiWYgrWpEXWuldVzaDARm8uV_6w5uAqI7A28AV3sI67L7J4uCF-9hOXW8CKKLHLPZTK9gzU6CzgwJdk5dcr_zErE",
    side: "left",
  },
  {
    id: "sentient-nodes",
    title: "Sentient Nodes",
    year: "2023",
    category: "Data Viz",
    summary:
      "An interactive WebGL exploration of neural networks visualized as organic, breathing light structures.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDQQzbaUSpDNY3zpF6TB-UoePhXJsppfGae1qeSQ1VXcKBakqLaOgq2nkvDymHIgOmmzr1ysejsKUOIseAg0YRquHvtNteq4bl4AeucI0mFQIQLeFmpDFAk1SUtYMJr8sI55ie6n3Rwv-NN3yxKfzI_bc5j3mtJfNT0wyDU0noc4MYfKB6Tg35ULCIYdhsJcFeg0LdReJg9JMKXg__j7KTi1PaNxekH9YLmg3TQsey-np4M_MFu3yEd2vvmNUWdLAPDkGR3FXmJvAQN",
    side: "right",
  },
  {
    id: "mono-objects",
    title: "Mono Objects",
    year: "2023",
    category: "E-commerce",
    summary:
      "A brutalist approach to online retail, stripping away distractions to focus purely on form and function.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAhMws6Shyuk4QRp4NaKBuoYExU7aafn8AOJ0LbQ_eAL-pjpFHfwhDXl5TpJmTXuPRuSMEdMHueIoiFBbGeyP0a-8iIVC-b0fo1NNj13re8OVxgRtOVo7UscYyE7Han2bXFi9AGmzmLpqrIBPVc9yv4a3d7AR2uNWOtnbhNX81IFbqhNs2NjX1skjzZ2Vn-5Hi8vHeHQT5Wv_YB9uMWF4Yg2ik257F5b0Y4SGaEZ7J6nbGggjr_F3EIZ3QtvMHrzxYJKHojXlC-1MuT",
    side: "left",
  },
  {
    id: "atmosphere",
    title: "Atmosphere",
    year: "2022",
    category: "Mobile App",
    summary:
      "Weather forecasting reimagined as an ambient background utility that blends into your daily digital routine.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA9hkORmimTo5FBmvlajpgwKNMDpYzSeAZOKcVLN2Fi1yhrCJNEBDdRi6_1jE1J14gfwsEu2fOq89czGsgGWTIDLlYnXitUsAUBldfsJ6Pz5fCX3pLoZfg272AuxE6nlLDpXOSaonTdmnPfWf23QKKis0L4eXYM6FEIFoeFFnTaagqdNZN7RJmWX5fox-8IIYEaxMIg9dU-4kWYhnrc9XvMTlvLtq4YcB474dr4ypemdTW9eTmWTMAn_dq16WdzUkZwHemtUSB4lzTS",
    side: "right",
  },
  {
    id: "type-and-tone",
    title: "Type & Tone",
    year: "2022",
    category: "Editorial",
    summary:
      "An experimental digital magazine exploring the relationship between typographic rhythm and reading comprehension.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCzhHcIvNnzJbT_zQ5n5Bdi7_Dwg7rzXRHHZ-v82uXLoF-4gzqQBAakYPXh7Wh0koUdg4GjidBptfg0nmI0qSOwDIwkf2CZsiv_N1VAvaHwhAbfZftxW4unqOI9qVLb7y1N-_BMwO320peeblVJymMl91tYArWJcdf5duZcvbenqPk9P6bA-9JtpiWYgrWpEXWuldVzaDARm8uV_6w5uAqI7A28AV3sI67L7J4uCF-9hOXW8CKKLHLPZTK9gzU6CzgwJdk5dcr_zErE",
    side: "left",
  },
];

export const homeProjects: HomeProject[] = [
  {
    id: "sentient-analytics",
    title: "Sentient Analytics",
    category: "Development",
    type: "SaaS",
    summary:
      "An AI-driven analytics dashboard for small businesses to predict market trends using minimal data inputs.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBlkbMj1Oi_XWv31xdzwdEX1l04TUTytTYPVVdMBvG4A6suYkNFqvuDlZqYLb7hmJvUrsNxghg0KxMGvFBcmFLHvSFn15QFxxwSe8ZtA-0MIrst_fRPJCVK0oqPpVEuALgFV4S5TxXAE3UUY6DqsLDmBDNqtBSmSlSzqpCL1CBIPWk3M73BKU5iCbeptqtfQCeN2yg0VXOAq4EIph5kXeHXPAXgwXbDDzh5zsc5VfcefEbotYDhz1qK0qu28QbFlTMcirgZX61DRxRJ",
    cta: "View Case Study",
  },
  {
    id: "wanderlust-redesign",
    title: "Wanderlust Redesign",
    category: "UX Research",
    type: "Mobile",
    summary:
      "Redefining the travel planning experience through intuitive gesture-based navigation and localized discovery.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBbbeWUmw_F9EExxhDyh-wyQ1218cCRkulk21PCbS0tbFHnlEf5Lm4Q5o5ffu9Wy1NU-BvksJlliLJIeqcY7YGQbFU1nTqzKEI3E3ap9bi4nYX6nGdmJraee3Xuv-s45yAPuS2ClT-B_UBDYFdXcmd8d15Ed4xASmN8gNR6mEwY7XlDBoaHtEfDsO4lzpNf7mLRWBue3qgPZbWz4brPjFj_93LYdBHtgZqMaCyol7Uh2Oa9DUvk4LGmyyxlRcnJTXv7vNHaeU2RensU",
    cta: "View Prototype",
  },
  {
    id: "tailwind-animator",
    title: "Tailwind Animator",
    category: "Open Source",
    type: "Library",
    summary:
      "A lightweight utility library for creating complex SVG animations directly within your HTML classes.",
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDJmjKxrgKmgSQHXLT1SLSD8RcWWDWKe165V792KH9JBWOTACBp-l6k1_VvyIoOLa1C8kEIzN1Exgme8RdNbHSGiCn7D_Qpyjq1l0GFS0Ezl1o-uSyaxwLRTOUpO8i3lD4Q1n3JFlsBIn1T2jvZZU0YH2BnH5kfGtcT1I52T44YMdZFMYD08VVb0JfB2r5w8CyULon3-ZVXQFS-4J_nVhA7c-4Uy3jOBdg4MlQZJFLBOl9idtLZcN4AZZCFAzrhWxSu7yL60uoRlALH",
    cta: "View Repository",
  },
];
