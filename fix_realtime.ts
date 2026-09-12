import fs from 'fs';
let content = fs.readFileSync('src/components/PerizinanPanel.tsx', 'utf-8');

const oldRealtime = `    // Setup Realtime subscription on perizinan table
    const perizinanChannel = supabase
      .channel("realtime-perizinan-modul")
      .on("postgres_changes", { event: "*", schema: "public", table: "perizinan" }, () => {
        fetchPerizinanDataRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(perizinanChannel);
    };`;

const newRealtime = `    // Setup Realtime subscription on perizinan tables
    const perizinanChannel = supabase
      .channel("realtime-perizinan-modul")
      .on("postgres_changes", { event: "*", schema: "public", table: "izin_sambang" }, () => {
        fetchPerizinanDataRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "izin_sakit" }, () => {
        fetchPerizinanDataRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "izin_haid" }, () => {
        fetchPerizinanDataRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(perizinanChannel);
    };`;

content = content.replace(oldRealtime, newRealtime);

fs.writeFileSync('src/components/PerizinanPanel.tsx', content);
