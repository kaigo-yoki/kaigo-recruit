// MANA API から利用者数を取得（insuredPersons のみ）
fetch('https://asia-northeast1-aimana-8a09c.cloudfunctions.net/getCompanyData?includeInsuredPersons=true')
  .then(r => r.json())
  .then(data => {
    const persons = data.insuredPersons.filter(p => p.insuredPersonStatus === 'using');
    
    const home1 = persons.filter(p => p.facilityName === 'HOME1').length;
    const home2 = persons.filter(p => p.facilityName === 'HOME2').length;
    const home3 = persons.filter(p => p.facilityName === 'HOME3').length;
    
    console.log('=== MANA 利用者数（利用中のみ）===');
    console.log('HOME1:', home1, '名');
    console.log('HOME2:', home2, '名');
    console.log('HOME3:', home3, '名');
    console.log('合計:', home1 + home2 + home3, '名');
  });
