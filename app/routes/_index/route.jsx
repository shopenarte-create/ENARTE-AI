import React, { useState } from "react";
import { BUDGET_OPTIONS } from "../../services/budget.js";

export default function App() {
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [budget, setBudget] = useState("");
  const [selectedBudgetLabel, setSelectedBudgetLabel] = useState("");

  const handleUpload = () => {
    document.getElementById("roomImage").click();
  };

  const handleAnalyze = async () => {
    if (!imageFile) {
      alert("اختر صورة أولاً");
      return;
    }

    setLoading(true);
    setResult("");
    setSelectedBudgetLabel("");

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (budget) {
        formData.append("budget", budget);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
 console.log("STATUS:", response.status);

const text = await response.text();

console.log("SERVER RESPONSE:");
console.log(text);

let data;

try {
  data = JSON.parse(text);
  console.log("DATA:", data);
console.log("RESULT:", data.result);
} catch (e) {
  alert("السيرفر لم يرجع JSON");
  console.log("HTML RESPONSE:", text);
  setLoading(false);
  return;
}

      if (data.success) {
        setResult(data.result);
        if (data.budgetExplicit && data.budgetRange?.labelAr) {
          setSelectedBudgetLabel(data.budgetRange.labelAr);
        }
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert(e.message);
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "40px auto",
        padding: "30px",
        fontFamily: "Arial",
      }}
    >
      <h1>💡 ENARTE AI</h1>

      <h2>اعثر على الثريا المناسبة خلال دقيقة</h2>

      <p>
        ارفع صورة الغرفة وسنقترح عليك أفضل الثريات مع تركيبها على الصورة.
      </p>

      <div
        style={{
          marginTop: "20px",
          marginBottom: "10px",
          direction: "rtl",
          textAlign: "right",
        }}
      >
        <label
          htmlFor="budgetSelect"
          style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}
        >
          الميزانية (اختياري)
        </label>
        <select
          id="budgetSelect"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "360px",
            padding: "12px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
          }}
        >
          <option value="">— بدون اختيار —</option>
          {BUDGET_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.labelAr}
            </option>
          ))}
        </select>
      </div>

      <input
        id="roomImage"
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files[0];

          if (file) {
            setImage(URL.createObjectURL(file));
            setImageFile(file);
            setFileName(file.name);
          }
        }}
      />

      <button
        onClick={handleUpload}
        style={{
          padding: "15px 25px",
          fontSize: "18px",
          cursor: "pointer",
          borderRadius: "8px",
          background: "#111827",
          color: "#fff",
          border: "none",
        }}
      >
        ابدأ الآن
      </button>

      <button
        onClick={handleAnalyze}
        style={{
          marginTop: "15px",
          marginLeft: "10px",
          padding: "15px 25px",
          fontSize: "18px",
          cursor: "pointer",
          borderRadius: "8px",
          background: "#2563eb",
          color: "#fff",
          border: "none",
        }}
      >
        🔍 ابحث عن أفضل ثرية
      </button>

      {loading && (
        <p style={{ marginTop: "20px" }}>
          🔍 جاري تحليل الصورة...
        </p>
      )}

      {fileName && (
        <p style={{ marginTop: "10px" }}>
          📷 {fileName}
        </p>
      )}

      {image && (
        <div style={{ marginTop: "20px" }}>
          <img
            src={image}
            alt="الغرفة"
            style={{
              width: "100%",
              maxWidth: "500px",
              borderRadius: "10px",
            }}
          />
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            borderRadius: "10px",
            background: "#f3f4f6",
            whiteSpace: "pre-wrap",
            direction: "rtl",
            textAlign: "right",
          }}
        >
          {result}
          {selectedBudgetLabel && (
            <p
              style={{
                marginTop: "16px",
                marginBottom: 0,
                paddingTop: "12px",
                borderTop: "1px solid #d1d5db",
                fontWeight: "bold",
              }}
            >
              الميزانية المختارة: {selectedBudgetLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
