let buyingRates = {};
let sellingRates = {};
let rates = {};

const inputs = ["GHS", "USD", "EUR", "GBP", "CNY", "NGN"];

let isUpdating = false;

let currentRateType = "selling";


async function loadRates() {

  try {

    const res = await fetch("./rates.json");

    if (!res.ok) {
      throw new Error("Failed to load rates.json");
    }


    const data = await res.json();


    buyingRates = data.buying || {};
    sellingRates = data.selling || {};


    // Default remains SELLING (same as old app)
    rates = sellingRates;


    const lastUpdated = document.getElementById("lastUpdated");


    if (lastUpdated) {

      const updatedAt = data.updated_at
        ? new Date(data.updated_at).toLocaleString()
        : "Unknown time";


      const sourceDate = data.source_page_date || "Unknown date";


      lastUpdated.textContent =
        `BoG Date: ${sourceDate} | Updated: ${updatedAt}`;

    }


    attachInputHandlers();

    setupRateSwitch();

    seedDefaultValue();


  } catch(error) {


    const lastUpdated =
      document.getElementById("lastUpdated");


    if(lastUpdated){

      lastUpdated.textContent =
        "Unable to load exchange rates";

    }


    console.error(error);

  }

}




function setupRateSwitch(){


  const buyingBtn =
    document.getElementById("buyingBtn");


  const sellingBtn =
    document.getElementById("sellingBtn");



  if(!buyingBtn || !sellingBtn){
    return;
  }



  sellingBtn.classList.add("active");



  buyingBtn.addEventListener("click",()=>{


    currentRateType="buying";


    rates=buyingRates;


    buyingBtn.classList.add("active");

    sellingBtn.classList.remove("active");


    recalculate();


  });



  sellingBtn.addEventListener("click",()=>{


    currentRateType="selling";


    rates=sellingRates;


    sellingBtn.classList.add("active");

    buyingBtn.classList.remove("active");


    recalculate();


  });


}





function recalculate(){


  for(const id of inputs){


    const field=document.getElementById(id);


    if(
      field &&
      field.value !== ""
    ){


      const value=parseFloat(
        cleanNumber(field.value)
      );


      if(!Number.isNaN(value)){


        convertFrom(id,value);

      }


      return;

    }

  }


  seedDefaultValue();

}





function attachInputHandlers(){


  inputs.forEach((id)=>{


    const input=document.getElementById(id);


    if(!input){
      return;
    }



    input.addEventListener("input",(event)=>{


      if(isUpdating){
        return;
      }



      const rawText=event.target.value;


      const cleaned=cleanNumber(rawText);



      event.target.dataset.raw=cleaned;



      if(cleaned==="" || cleaned==="."){


        clearOtherInputs(id);

        return;

      }



      const value=parseFloat(cleaned);



      if(Number.isNaN(value)){
        return;
      }



      convertFrom(id,value);



    });




    input.addEventListener("focus",()=>{


      const raw =
        input.dataset.raw ??
        cleanNumber(input.value);



      input.value=raw;

      input.select();



    });





    input.addEventListener("blur",()=>{


      const raw=input.dataset.raw;



      if(
        raw &&
        raw !== "." &&
        !Number.isNaN(parseFloat(raw))
      ){


        input.value=
          formatNumber(parseFloat(raw));


      }


    });



  });



}





function cleanNumber(value){


  let cleaned =
    value
    .replace(/,/g,"")
    .replace(/[^\d.]/g,"");



  const firstDot =
    cleaned.indexOf(".");


  if(firstDot!==-1){


    cleaned =
      cleaned.slice(0,firstDot+1)
      +
      cleaned
      .slice(firstDot+1)
      .replace(/\./g,"");


  }



  return cleaned;

}





function roundTo2(value){

  return Math.round(
    (value + Number.EPSILON)*100
  )/100;

}





function toGHS(currency,value){


  if(currency==="GHS"){
    return value;
  }


  return value * rates[currency];

}





function fromGHS(currency,ghsValue){


  if(currency==="GHS"){
    return ghsValue;
  }


  return ghsValue / rates[currency];

}





function formatNumber(value){


  return value.toLocaleString(
    "en-US",
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2
    }
  );


}





function convertFrom(base,value){


  if(
    base!=="GHS" &&
    !rates[base]
  ){
    return;
  }



  isUpdating=true;



  const ghsValue =
    toGHS(base,value);




  inputs.forEach((currency)=>{


    const field =
      document.getElementById(currency);



    if(!field){
      return;
    }



    if(
      currency===base &&
      document.activeElement===field
    ){
      return;
    }




    const converted =
      fromGHS(currency,ghsValue);




    if(!Number.isFinite(converted)){


      field.dataset.raw="";

      field.value="";

      return;

    }




    const rounded =
      roundTo2(converted);



    field.dataset.raw =
      rounded.toFixed(2);



    field.value =
      formatNumber(rounded);



  });



  isUpdating=false;


}





function clearOtherInputs(activeId){


  inputs.forEach((currency)=>{


    const field =
      document.getElementById(currency);



    if(
      !field ||
      currency===activeId
    ){
      return;
    }



    field.value="";

    field.dataset.raw="";


  });



}





function seedDefaultValue(){


  const ghsInput =
    document.getElementById("GHS");



  if(!ghsInput){
    return;
  }



  ghsInput.dataset.raw="1";

  ghsInput.value=formatNumber(1);


  convertFrom("GHS",1);


}





document.addEventListener(
  "DOMContentLoaded",
  loadRates
);
