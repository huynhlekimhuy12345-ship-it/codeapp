// Ô chọn ngày + giờ dùng react-datepicker, giao diện tối đồng bộ theme.
// Props: id, value (chuỗi "YYYY-MM-DDTHH:mm" như datetime-local), onChange(chuỗi), placeholder
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DateTimeField.css';

function parseValue(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function toLocalString(d) {
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function DateTimeField({ id, value, onChange, placeholder }) {
  return (
    <div className="dt-field">
      <DatePicker
        id={id}
        selected={parseValue(value)}
        onChange={(d) => onChange(toLocalString(d))}
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={15}
        dateFormat="dd/MM/yyyy HH:mm"
        placeholderText={placeholder || 'Chọn ngày giờ...'}
        className="dt-input"
        calendarClassName="dt-calendar"
        isClearable
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
      />
      <span className="dt-icon" aria-hidden="true">📅</span>
    </div>
  );
}
