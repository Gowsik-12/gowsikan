import { Holiday, HandbookSection } from './types';

export const COMPANY_HANDBOOK_METADATA = {
  filename: "Company_Handbook.pdf",
  lastUpdated: "2024-10-15",
  pages: 2
};

export const COMPANY_HANDBOOK: HandbookSection[] = [
  {
    title: "Leave Policy",
    content: "Employees are entitled to 20 days of paid leave per year. Application for leave should be submitted via the HR Portal and approved by the direct manager at least two weeks in advance. Unused leave balance does not carry over to the next calendar year. For emergency leave, notify your supervisor immediately."
  },
  {
    title: "Office Timing",
    content: "Standard operating hours are 9:00 AM to 6:00 PM, Monday through Friday. Core hours for meetings are 10:00 AM to 4:00 PM. A mandatory 1-hour lunch break is scheduled between 12:30 PM and 1:30 PM. Flexible start times between 8:00 AM and 10:00 AM are available with manager approval."
  },
  {
    title: "Dress Code",
    content: "The company maintains a professional image. Business casual is required from Monday to Thursday (e.g., chinos, slacks, blouses, collared shirts). On 'Casual Fridays', employees may wear jeans and sneakers, provided they are clean and in good repair. Logo-branded company apparel is always encouraged."
  },
  {
    title: "Remote Work & Hybrid Model",
    content: "We operate on a hybrid model. Staff are required to be in the physical office at least 3 days per week. Mondays and Wednesdays are 'anchor days' where the entire team is present for synchronization and collaboration. Remote work days must be logged in the team calendar."
  },
  {
    title: "Equipment & IT Support",
    content: "New hires receive a high-spec laptop, external monitor, and ergonomic peripheral kit. For technical issues, contact the IT Helpdesk at ext. 404 or raise a ticket on the internal ServiceDesk portal."
  }
];

export const EXTERNAL_SOURCE_METADATA = {
  name: "Office Holidays 2024",
  type: "Google Sheet",
  url: "https://docs.google.com/spreadsheets/d/office-holidays-2024"
};

export const OFFICE_HOLIDAYS_2024: Holiday[] = [
  { date: "2024-01-01", name: "New Year's Day" },
  { date: "2024-01-15", name: "Martin Luther King Jr. Day" },
  { date: "2024-05-27", name: "Memorial Day" },
  { date: "2024-06-19", name: "Juneteenth" },
  { date: "2024-07-04", name: "Independence Day" },
  { date: "2024-09-02", name: "Labor Day" },
  { date: "2024-11-11", name: "Veterans Day" },
  { date: "2024-11-28", name: "Thanksgiving Day" },
  { date: "2024-11-29", name: "Day after Thanksgiving" },
  { date: "2024-12-25", name: "Christmas Day" }
];