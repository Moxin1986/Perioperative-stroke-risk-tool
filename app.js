// For Major Surgery Perioperative Stroke Risk Assessment Tool
// Evidence-based calculator implementing validated logistic regression model

// 1. Model coefficients (β̂) from Stata
// 1. Updated β̂ from Stata (n = 9,652,133)
const coefs = {
  intercept:          -7.006029,
  age:                 0.0128988,
  female:              0.0263931,
  pay1_2:              0.1547363,
  pay1_3:              0.1425205,
  pay1_4:              0.2565273,
  zipinc_qrtl_2:      -0.056073,
  zipinc_qrtl_3:      -0.0368253,
  zipinc_qrtl_4:      -0.0661107,
  aprdrg_severity_2:   1.943677,  
  aprdrg_severity_3:   3.054484,
  elective:           -0.8209716,
  diabetes_mellitus:   0.1004419,
  hypertension:        0.1875834,
  hyperlipidemia:      0.1697699,
  history_stroke:      1.026738,
  carotid_stenosis:    0.8267146,
  intracranial_athero: 2.193572,
  chf:                -0.0427717,
  afib:                0.1747905,
  chronic_lung_disease:-0.3066023,
  ckd:                -0.2339255,
  active_cancer:      -0.6413832,
  coagulopathy:        0.2247981,
  substance_abuse:     0.2205459, 
  procedure_1:                 1.960397,  // Neurosurgery
  procedure_2:                -0.0351098,  // Cardiovascular Procedure
};

// 2. Updated SEs from Stata (for delta-method CI; diagonal only)
const ses = {
  intercept:           0.0315048,
  age:                 0.0003596,
  female:              0.0074252,
  pay1_2:              0.0138936,
  pay1_3:              0.0109511,
  pay1_4:              0.0268279,
  zipinc_qrtl_2:       0.0110647,
  zipinc_qrtl_3:       0.010886,
  zipinc_qrtl_4:       0.0129829,
  aprdrg_severity_2:   0.0169319,  
  aprdrg_severity_3:   0.0184439,
  elective:            0.0135107,
  diabetes_mellitus:   0.0081614,
  hypertension:        0.0108338,
  hyperlipidemia:      0.0090424,
  history_stroke:      0.0113151,
  carotid_stenosis:    0.0168313,
  intracranial_athero: 0.052665,
  chf:                 0.0100778,
  afib:                0.0092701,
  chronic_lung_disease:0.0099025,
  ckd:                 0.0092093,
  active_cancer:       0.0123689,
  coagulopathy:        0.0136913,
  substance_abuse:     0.0097986, 
  procedure_1:                 0.0148637,  // Neurosurgery
  procedure_2:                 0.0122122  // Cardiovascular Procedure
};

// 3. Clinical guidance recommendations
const clinicalGuidance = {
  low: {
    title: "Low Risk (< 1%)",
    recommendations: [
      "Standard perioperative monitoring is appropriate",
      "Routine preoperative evaluation sufficient",
      "No additional stroke-specific precautions required",
      "Consider standard ASA monitoring guidelines"
    ]
  },
  moderate: {
    title: "Moderate Risk (1-5%)",
    recommendations: [
      "Enhanced perioperative monitoring recommended",
      "Consider preoperative neurology consultation",
      "Implement stroke-specific monitoring protocols",
      "Monitor blood pressure closely during procedure",
      "Consider extended post-operative observation"
    ]
  },
  high: {
    title: "High Risk (≥ 5%)",
    recommendations: [
      "Intensive perioperative monitoring required",
      "Preoperative neurology consultation strongly recommended",
      "Consider postponing elective procedures if possible",
      "Implement comprehensive stroke prevention protocols",
      "Extended post-operative monitoring in ICU setting",
      "Multidisciplinary team consultation recommended"
    ]
  }
};

// 4. DOM elements
const form = document.getElementById('riskForm');
const probSpan = document.getElementById('predprob');
const resultBox = document.getElementById('result');
const confidenceInterval = document.getElementById('confidence-interval');
const ciValue = document.getElementById('ci-value');
const clinicalGuidanceBox = document.getElementById('clinical-guidance');
const guidanceContent = document.getElementById('guidance-content');

// 5. Main calculation function
function calculateRisk() {
  // Input validation and collection
  const inputs = collectAndValidateInputs();
  if (!inputs.valid) {
    displayError(inputs.message);
    return;
  }

  // Calculate risk
  const riskResult = calculateRiskProbability(inputs);
  
  // Update UI
  updateResults(riskResult);
  updateClinicalGuidance(riskResult.probability);
}

// 6. Input collection and validation
function collectAndValidateInputs() {
  const age = parseFloat(document.getElementById('age').value) || 0;
  
  // Validate age
  if (!age || age < 18 || age > 120) {
    return {
      valid: false,
      message: age < 18 ? 'Age must be 18 or older' : 'Please enter a valid age (18-120 years)'
    };
  }
  
  return {
    valid: true,
    age: age,
    female: document.getElementById('female').checked,
    pay1: document.getElementById('pay1').value,
    zipinc_qrtl: document.getElementById('zipinc_qrtl').value,
    aprdrg_severity: document.getElementById('aprdrg_severity').value,
    elective: document.getElementById('elective').checked,
    diabetes_mellitus: document.getElementById('diabetes_mellitus').checked,
    hypertension: document.getElementById('hypertension').checked,
    hyperlipidemia: document.getElementById('hyperlipidemia').checked,
    history_stroke: document.getElementById('history_stroke').checked,
    carotid_stenosis: document.getElementById('carotid_stenosis').checked,
    intracranial_athero: document.getElementById('intracranial_athero').checked,
    chf: document.getElementById('chf').checked,
    afib: document.getElementById('afib').checked,
    chronic_lung_disease: document.getElementById('chronic_lung_disease').checked,
    ckd: document.getElementById('ckd').checked,
    active_cancer: document.getElementById('active_cancer').checked,
    coagulopathy: document.getElementById('coagulopathy').checked,
    substance_abuse: document.getElementById('substance_abuse').checked,
    procedure: document.getElementById('procedure').value
   
  };
}

// 7. Risk calculation with confidence intervals
function calculateRiskProbability(inputs) {
  // Build covariate vector
  const x = {
    intercept: 1,
    age: inputs.age,
    female: inputs.female ? 1 : 0,
    pay1_2: inputs.pay1 === '2' ? 1 : 0,
    pay1_3: inputs.pay1 === '3' ? 1 : 0,
    pay1_4: inputs.pay1 === '4' ? 1 : 0,
    zipinc_qrtl_2: inputs.zipinc_qrtl === '2' ? 1 : 0,
    zipinc_qrtl_3: inputs.zipinc_qrtl === '3' ? 1 : 0,     
    zipinc_qrtl_4: inputs.zipinc_qrtl === '4' ? 1 : 0,     
    aprdrg_severity_2: inputs.aprdrg_severity === '2' ? 1 : 0,  
    aprdrg_severity_3: inputs.aprdrg_severity === '3' ? 1 : 0,  
    elective: inputs.elective ? 1 : 0,
    diabetes_mellitus: inputs.diabetes_mellitus ? 1 : 0,
    hypertension: inputs.hypertension ? 1 : 0,
    hyperlipidemia: inputs.hyperlipidemia ? 1 : 0,
    history_stroke: inputs.history_stroke ? 1 : 0,
    carotid_stenosis: inputs.carotid_stenosis ? 1 : 0,
    intracranial_athero: inputs.intracranial_athero ? 1 : 0,
    chf: inputs.chf ? 1 : 0,
    afib: inputs.afib ? 1 : 0,
    chronic_lung_disease: inputs.chronic_lung_disease ? 1 : 0,
    ckd: inputs.ckd ? 1 : 0,
    active_cancer: inputs.active_cancer ? 1 : 0,
    coagulopathy: inputs.coagulopathy ? 1 : 0,
    substance_abuse: inputs.substance_abuse ? 1 : 0,
    procedure_1: inputs.procedure === '1' ? 1 : 0,
    procedure_2: inputs.procedure === '2' ? 1 : 0,
    
  };

  // Calculate linear predictor
  let xb = 0;
  for (const key in coefs) {
    xb += coefs[key] * x[key];
  }

  // Calculate confidence interval
  let var_xb = 0;
  for (const key in ses) {
    var_xb += (ses[key] ** 2) * (x[key] ** 2);
  }
  const se_xb = Math.sqrt(var_xb);

  // 95% confidence interval
  const z = 1.96;
  const xb_lo = xb - z * se_xb;
  const xb_hi = xb + z * se_xb;

  // Transform to probabilities
  const probability = 1 / (1 + Math.exp(-xb));
  const prob_lo = 1 / (1 + Math.exp(-xb_lo));
  const prob_hi = 1 / (1 + Math.exp(-xb_hi));

  return {
    probability: probability,
    confidenceInterval: {
      lower: prob_lo,
      upper: prob_hi
    },
    linearPredictor: xb
  };
}

// 8. Update results display
function updateResults(riskResult) {
  const pct = riskResult.probability * 100;
  
  // Update main result
  probSpan.textContent = `${pct.toFixed(1)}%`;
  
  // Update confidence interval
  const ci_lower = (riskResult.confidenceInterval.lower * 100).toFixed(1);
  const ci_upper = (riskResult.confidenceInterval.upper * 100).toFixed(1);
  ciValue.textContent = `${ci_lower}% - ${ci_upper}%`;
  confidenceInterval.style.display = 'block';
  
  // Update color coding
  updateColorCoding(pct);
}

// 9. Update color coding based on risk level
function updateColorCoding(riskPercentage) {
  if (riskPercentage < 1) {
    resultBox.className = 'results success';
  } else if (riskPercentage >= 1 && riskPercentage < 5) {
    resultBox.className = 'results warning';
  } else {
    resultBox.className = 'results error';
  }
}

// 10. Update clinical guidance
function updateClinicalGuidance(probability) {
  const pct = probability * 100;
  let guidance;
  
  if (pct < 1) {
    guidance = clinicalGuidance.low;
  } else if (pct < 5) {
    guidance = clinicalGuidance.moderate;
  } else {
    guidance = clinicalGuidance.high;
  }
  
  guidanceContent.innerHTML = `
    <h4>${guidance.title}</h4>
    <ul>
      ${guidance.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
  `;
  
  clinicalGuidanceBox.style.display = 'block';
}

// 11. Display error state
function displayError(message) {
  probSpan.textContent = message;
  confidenceInterval.style.display = 'none';
  clinicalGuidanceBox.style.display = 'none';
  resultBox.className = 'results';
}

// 12. Event listeners and initialization
document.addEventListener('DOMContentLoaded', function() {
  // Form event listeners
  form.addEventListener('input', calculateRisk);
  
  // Initial calculation
  calculateRisk();
  
  // Add keyboard navigation
  addKeyboardNavigation();
  
  // Add form validation
  addFormValidation();
});

// 13. Keyboard navigation support
function addKeyboardNavigation() {
  const inputs = form.querySelectorAll('input, select');
  inputs.forEach((input, index) => {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && index < inputs.length - 1) {
        e.preventDefault();
        inputs[index + 1].focus();
      }
    });
  });
}

// 14. Form validation feedback
function addFormValidation() {
  const ageInput = document.getElementById('procAge');
  
  ageInput.addEventListener('blur', function() {
    const age = parseFloat(this.value);
    if (age && (age < 18 || age > 120)) {
      this.setCustomValidity('Age must be between 18 and 120 years');
    } else {
      this.setCustomValidity('');
    }
  });
}

// 15. Export function for external use
window.BrownStrokeRiskCalculator = {
  calculate: calculateRisk,
  getModelInfo: () => ({
    coefficients: coefs,
    standardErrors: ses,
    version: '1.0.0',
    lastUpdated: '2025'
  })
};
