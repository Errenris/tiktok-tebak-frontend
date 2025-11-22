import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import questions from "../data/questions.json";

let socket;

export default function Home() {
  const [comments, setComments] = useState([]);
  const [scores, setScores] = useState({});
  const [roundOpen, setRoundOpen] = useState(false);
  const [wordLength, setWordLength] = useState(null);
  const [adminWord, setAdminWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [defaultTime, setDefaultTime] = useState(15);
  const [autoNext, setAutoNext] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    socket = io(process.env.NEXT_PUBLIC_BACKEND);

    socket.on("connect", () => console.log("connected"));
    socket.on("comment", (c) => {
      setComments((prev) => [c, ...prev].slice(0, 200));
    });

    socket.on("state", (s) => {
      setRoundOpen(s.roundOpen);
      setWordLength(s.wordLength);
      setScores(s.scores || {});
    });

    socket.on("correct", (d) => {
      setScores(d.scores || {});
      setComments((p) => [{ username: d.username, commentText: d.answer, correct: true }, ...p]);
    });

    socket.on("round", (r) => setRoundOpen(r.open));
    socket.on("wordSet", (w) => setWordLength(w.wordLength));

    return () => socket && socket.disconnect();
  }, []);

  useEffect(() => {
    if (timeLeft === 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (roundOpen) {
        // end round
        callAdmin("stop");
        if (autoNext) {
          // small delay then next
          setTimeout(() => nextQuestion(), 1200);
        }
      }
    }
  }, [timeLeft]);

  const callAdmin = async (path, body = {}) => {
    const backend = process.env.NEXT_PUBLIC_BACKEND;
    await fetch(`${backend}/admin/${path}`, {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify(body),
    });
  };

  const setWordAndStart = async (word) => {
    await callAdmin("set-word",{word});
    await callAdmin("start");
    setTimeLeft(defaultTime);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => Math.max(0, t-1));
    }, 1000);
  };

  const startManual = async () => {
    const q = questions[currentQuestionIndex];
    if (!q) return alert("Tidak ada soal lagi");
    setWordAndStart(q.word);
  };

  const nextQuestion = () => {
    setCurrentQuestionIndex(i => {
      const next = i+1 < questions.length ? i+1 : 0;
      // automatically start next
      const q = questions[next];
      setTimeout(()=> setWordAndStart(q.word), 200);
      return next;
    });
  };

  const stopManual = async () => {
    await callAdmin("stop");
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimeLeft(0);
  };

  const setCustomWord = async () => {
    if (!adminWord) return;
    await setWordAndStart(adminWord);
    setAdminWord("");
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Tebak Kata — Live TikTok (Dark)</h1>
        <div className="row">
          <div className="timer card" style={{padding:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:72,height:72,position:"relative"}}>
                <div className="progress-circle" style={{["--pct"]: (timeLeft/defaultTime)*100 + "%"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700}}>{timeLeft}s</div>
                    <div className="small">sisa</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="small">Round</div>
                <div style={{fontWeight:700}}>{roundOpen ? "OPEN" : "CLOSED"}</div>
                <div className="small">Panjang kata: {wordLength ?? "-"}</div>
              </div>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="small">Waktu tiap soal (detik)</div>
            <input type="number" min="5" max="120" value={defaultTime} onChange={e=>setDefaultTime(Number(e.target.value))} style={{width:90,padding:8,borderRadius:8}} />
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:16}}>
        <div style={{flex:1}}>
          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <strong>Soal aktif</strong>
                <div className="small">Hint: {questions[currentQuestionIndex]?.hint ?? "-"}</div>
              </div>
              <div className="controls" style={{display:"flex",gap:8}}>
                <button className="btn" onClick={startManual}>Start</button>
                <button className="btn" onClick={stopManual}>Stop</button>
                <button className="btn" onClick={nextQuestion}>Skip → Next</button>
              </div>
            </div>

            <div style={{display:"flex",gap:12}}>
              <div style={{flex:1}}>
                <div className="small">Komentar live</div>
                <div className="comments" style={{marginTop:8}}>
                  {comments.map((c,i)=>(
                    <div key={i} className={"comment "+(c.correct ? "correct": "")}>
                      <b>{c.username}</b>: {c.commentText}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{width:320}}>
                <div style={{marginBottom:8}}>
                  <strong>Leaderboard</strong>
                  <div className="small">Top pemain</div>
                </div>
                <div className="card" style={{padding:8}}>
                  <ol className="leaderboard">
                    {Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(([u,p])=>(
                      <li key={u}><span>{u}</span><strong>{p}</strong></li>
                    ))}
                    {Object.keys(scores).length===0 && <div className="small">Belum ada pemain</div>}
                  </ol>
                </div>

                <div style={{marginTop:12}} className="card">
                  <div className="small">Admin: set kata manual</div>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <input value={adminWord} onChange={e=>setAdminWord(e.target.value)} placeholder="kata manual..." />
                    <button className="btn primary" onClick={setCustomWord}>Set & Start</button>
                  </div>
                  <div style={{marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <label className="small"><input type="checkbox" checked={autoNext} onChange={e=>setAutoNext(e.target.checked)} /> Auto-next</label>
                    <div className="small">Soal ke: {currentQuestionIndex+1}/{questions.length}</div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          <div className="footer">Deploy: Frontend ke Vercel, Backend ke Railway/Render. Pastikan env NEXT_PUBLIC_BACKEND diatur.</div>
        </div>
      </div>
    </div>
  );
}
