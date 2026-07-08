import React, { useState } from "react";

export default function App() {
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

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

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

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
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
}