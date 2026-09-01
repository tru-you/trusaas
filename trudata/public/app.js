document.addEventListener('DOMContentLoaded', () => {
  // Free sample handler
  document.getElementById('free-sample-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      // Mock for UI
      alert('Sample requested. Check your email shortly.');
      // Actual fetch when backend is ready
      // await fetch('/api/sample', { method: 'POST' });
    } catch (err) {
      console.error(err);
      alert('Error requesting sample.');
    }
  });

  // Currency formatter
  const formatZAR = new Intl.NumberFormat('en-ZA', { 
    style: 'currency', 
    currency: 'ZAR',
    maximumFractionDigits: 0
  });

  // Number animation function
  function animateValue(id, start, end, duration, formatter) {
    if (start === end) return;
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = Math.floor(progress * (end - start) + start);
      obj.innerHTML = formatter.format(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  // Valuation demo handler
  document.getElementById('valuation-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const make = document.getElementById('demo-make').value;
    const model = document.getElementById('demo-model').value;
    const year = document.getElementById('demo-year').value;
    
    if(!make || !model || !year) {
      alert("Please fill in all fields.");
      return;
    }

    const resultCard = document.getElementById('valuation-result');
    const loadingState = document.getElementById('valuation-loading');
    
    resultCard.classList.add('hidden');
    loadingState.classList.remove('hidden');

    try {
      // For now, simulate an API call since backend might not exist
      const isMock = true;
      let data;
      
      if (isMock) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Mock data logic based on make/year
        const basePrice = year >= 2020 ? 450000 : 250000;
        const multiplier = make === 'Toyota' || make === 'Volkswagen' ? 1.1 : 1.0;
        const avg = Math.floor(basePrice * multiplier);
        data = {
          marketAverage: avg,
          priceRange: { low: avg * 0.9, high: avg * 1.1 },
          confidence: 'HIGH',
          listingCount: Math.floor(Math.random() * 50) + 12
        };
      } else {
        const res = await fetch('/api/valuation/quick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ make, model, year })
        });
        data = await res.json();
      }
      
      loadingState.classList.add('hidden');
      
      // Update result card
      document.getElementById('val-avg').textContent = 'R 0'; // Start at 0 for animation
      document.getElementById('val-range').textContent = `${formatZAR.format(data.priceRange.low)} - ${formatZAR.format(data.priceRange.high)}`;
      document.getElementById('val-confidence').textContent = data.confidence;
      
      // Style confidence badge
      const confBadge = document.getElementById('val-confidence');
      if (data.confidence === 'HIGH') confBadge.style.color = '#07889B';
      if (data.confidence === 'MEDIUM') confBadge.style.color = '#F59E0B';
      if (data.confidence === 'LOW') confBadge.style.color = '#EF4444';
      
      document.getElementById('val-count').textContent = data.listingCount;
      
      resultCard.classList.remove('hidden');
      
      // Animate number
      animateValue("val-avg", 0, data.marketAverage, 1000, formatZAR);
      
    } catch (err) {
      console.error(err);
      loadingState.classList.add('hidden');
      alert('Error fetching valuation.');
    }
  });
  
  // Order Form display logic
  const orderSection = document.getElementById('order-section');
  const orderProduct = document.getElementById('order-product');
  const paramValuation = document.getElementById('param-valuation');
  const paramLeads = document.getElementById('param-leads');
  const paramAudit = document.getElementById('param-audit');

  document.querySelectorAll('.buy-now-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const product = btn.dataset.product;
      orderProduct.value = product;
      
      paramValuation.classList.add('hidden');
      paramLeads.classList.add('hidden');
      paramAudit.classList.add('hidden');
      
      // Make appropriate fields required/unrequired (simplified here)
      if (product === 'valuation') paramValuation.classList.remove('hidden');
      if (product === 'leads') paramLeads.classList.remove('hidden');
      if (product === 'audit') paramAudit.classList.remove('hidden');
      
      orderSection.classList.remove('hidden');
      
      // Smooth scroll to order section
      setTimeout(() => {
        orderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
  });
  
  // Order form submit
  document.getElementById('order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      name: document.getElementById('order-name').value,
      email: document.getElementById('order-email').value,
      product: orderProduct.value,
      params: {}
    };
    
    if (orderProduct.value === 'valuation') {
      formData.params.make = document.getElementById('order-make').value;
      formData.params.model = document.getElementById('order-model').value;
      formData.params.year = document.getElementById('order-year').value;
    } else if (orderProduct.value === 'leads') {
      formData.params.industry = document.getElementById('order-leads-industry').value;
      formData.params.region = document.getElementById('order-leads-region').value;
    } else if (orderProduct.value === 'audit') {
      formData.params.industry = document.getElementById('order-audit-industry').value;
      formData.params.city = document.getElementById('order-audit-city').value;
    }

    try {
      // Mocking submission
      alert(`Order submitted for ${orderProduct.value}! Redirecting to PayFast...`);
      
      /* Actual Implementation
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert('Order created, but no payment URL returned.');
      }
      */
    } catch (err) {
      console.error(err);
      alert('Error submitting order.');
    }
  });
});
