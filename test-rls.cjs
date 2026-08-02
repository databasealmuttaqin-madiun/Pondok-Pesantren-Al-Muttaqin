const { createClient } = require("@supabase/supabase-js");

const url = "https://eflhcunxpckcynozywol.supabase.co";
const key = "sb_publishable_fqZTO3lL9cb88K61NXjKHw_zH8O3TuZ";
const supabase = createClient(url, key);

async function testRls() {
  console.log("Checking if delete returns error or empty row array...");
  
  // Try inserting a dummy row
  const testNik = "99999" + Date.now().toString().slice(-8);
  const { data: ins, error: insErr } = await supabase.from("santri").insert([{
    nama_lengkap: "Test RLS Row",
    nama_panggilan: "RLS",
    nik: testNik,
    nisn: "00000",
    tempat_lahir: "Madiun",
    tanggal_lahir: "2010-01-01",
    alamat: "Test",
    rt: "01",
    rw: "01",
    desa_kelurahan: "Test",
    kecamatan: "Test",
    kabupaten_kota: "Madiun",
    provinsi: "Jawa Timur",
    nama_ayah: "Test",
    nama_ibu: "Test",
    kelompok_sambung: "Test",
    desa_sambung: "Test",
    daerah: "Madiun",
    jenis_kelamin: "L",
    kategori: "SMP"
  }]).select();

  console.log("Insert result:", ins, "Error:", insErr);

  if (ins && ins.length > 0) {
    const id = ins[0].id;
    console.log("Deleting inserted id:", id);
    const { data: delData, error: delErr, status } = await supabase
      .from("santri")
      .delete()
      .eq("id", id)
      .select();
    
    console.log("Delete response status:", status, "Data:", delData, "Error:", delErr);
  }
}

testRls();
