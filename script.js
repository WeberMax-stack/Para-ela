  tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
            serif: ['"Fraunces"', 'Georgia', 'serif'],
          },
          colors: {
            bg: '#141418',
            card: '#1E1E24',
            borderSubtle: '#2E2E38',
            cream: '#F4F1EA',
            muted: '#A39E93',
            coral: '#D97B66',
            gold: '#E5B96F',
            sage: '#7FA88A',
          },
        },
      },
    };

     // Configuração padrão (atualizada automaticamente ao baixar o arquivo HTML personalizado)
    // Para usar uma FOTO ESTÁTICA fixa, cole o link da imagem em "foto" (ex: "https://site.com/foto.jpg").
    // Para NÃO EXIBIR nenhuma foto na tela final, deixe "foto": "".
    const DEFAULT_CONFIG = /*__CONFIG_START__*/{
      "nome": "Giovanna",
      "msg": "Tava sem assunto para puxar hoje. Só queria dizer que você é muito linda alguém já te disse isso hoje? Deveriam!",
      "foto": "",
      "email": "",
      "assunto": "Oi! Joguei seu minigame ✨"
    }/*__CONFIG_END__*/;

    const STORAGE_KEY = 'cozy_flirt_minigame_email_v2';
    let config = { ...DEFAULT_CONFIG };
    let draftPhotoData = '';
    const HOLD_DURATION_MS = 1800; // 1.8 segundos
    const RING_CIRCUMFERENCE = 2 * Math.PI * 62; // ~389.56
    const SCRAMBLE_CHARS = '✦#@%&*?!§∆◊';

    // Estado de Áudio e Navegação
    let soundEnabled = true;
    let audioCtx = null;
    let currentScreen = 'screen-intro';
    let toastTimer = null;

    // Estado da Fase 1 (Sintonia)
    let tunerAnimId = null;
    let phase1Locked = false;
    let tunerPos = 5;
    let tunerDir = 1;
    let tunerTargetStart = 36;
    let tunerTargetWidth = 28;

    // Estado da Fase 2 (Faíscas)
    const TOTAL_SPARKS = 6;
    let sparksAnimId = null;
    let sparksList = [];
    let sparksCollected = 0;

    // Estado da Fase 3 (Decodificação)
    let holdAnimId = null;
    let isHolding = false;
    let holdProgress = 0;
    let phase3Completed = false;

    // Estado dos Confetes
    let confettiAnimId = null;
    let confettiParticles = [];

    // ---------------------------------------------------------
    // CARREGAMENTO E APLICAÇÃO DA CONFIGURAÇÃO
    // ---------------------------------------------------------
    function loadConfig() {
      let merged = { ...DEFAULT_CONFIG };

      try {
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed && typeof parsed === 'object') {
            merged = { ...merged, ...parsed };
          }
        }
      } catch (e) {}

      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('nome') && params.get('nome').trim()) {
          merged.nome = params.get('nome').trim();
        }
        if (params.has('msg') && params.get('msg').trim()) {
          merged.msg = params.get('msg').trim();
        }
        if (params.has('foto') && params.get('foto').trim()) {
          merged.foto = params.get('foto').trim();
        }
        if (params.has('email')) {
          merged.email = params.get('email').trim();
        }
        if (params.has('assunto') && params.get('assunto').trim()) {
          merged.assunto = params.get('assunto').trim();
        }
      } catch (e) {}

      config = merged;
    }

    function applyConfigToUI() {
      const revealNameEl = document.getElementById('reveal-name');
      const revealMsgEl = document.getElementById('reveal-message');
      const photoFrame = document.getElementById('reveal-photo-frame');
      const photoImg = document.getElementById('reveal-photo-img');
      const emailBadge = document.getElementById('email-target-badge');

      if (revealNameEl) {
        revealNameEl.textContent = config.nome || DEFAULT_CONFIG.nome;
      }
      if (revealMsgEl) {
        revealMsgEl.textContent = config.msg || DEFAULT_CONFIG.msg;
      }

      if (photoFrame && photoImg) {
        if (config.foto && config.foto.trim() !== '') {
          photoImg.src = config.foto.trim();
          photoFrame.classList.remove('hidden');
        } else {
          photoImg.removeAttribute('src');
          photoFrame.classList.add('hidden');
        }
      }

      if (emailBadge) {
        const cleanEmail = (config.email || '').trim();
        emailBadge.textContent = cleanEmail ? `Para: ${cleanEmail}` : '';
      }
    }

    function handleRevealImageError() {
      const photoFrame = document.getElementById('reveal-photo-frame');
      if (photoFrame) {
        photoFrame.classList.add('hidden');
      }
    }

    function handleRevealImageError() {
      const photoImg = document.getElementById('reveal-photo-img');
      const photoPlaceholder = document.getElementById('reveal-photo-placeholder');
      photoImg.classList.add('hidden');
      photoPlaceholder.classList.remove('hidden');
    }

    // ---------------------------------------------------------
    // MOTOR DE ÁUDIO SINTETIZADO (WEB AUDIO API)
    // ---------------------------------------------------------
    function ensureAudioContext() {
      try {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
          }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      } catch (e) {}
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      const iconEl = document.getElementById('sound-icon');
      const labelEl = document.getElementById('sound-label');

      if (iconEl) iconEl.textContent = soundEnabled ? '🔊' : '🔇';
      if (labelEl) labelEl.textContent = soundEnabled ? 'Som' : 'Mudo';

      if (soundEnabled) {
        ensureAudioContext();
        playTone(587.33, 0.1, 'sine', 0.06);
      }
    }

    function playTone(freq, duration = 0.15, type = 'sine', gainVal = 0.08) {
      if (!soundEnabled) return;
      ensureAudioContext();
      if (!audioCtx) return;

      try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.02);
      } catch (e) {}
    }

    function playSparkSound(index) {
      const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      playTone(notes[index % notes.length], 0.18, 'triangle', 0.09);
    }

    function playPhaseSuccessSound() {
      playTone(523.25, 0.16, 'sine', 0.08);
      setTimeout(() => playTone(659.25, 0.24, 'sine', 0.09), 110);
    }

    function playRevealFanfare() {
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 0.35, 'triangle', 0.085), idx * 95);
      });
    }

    // ---------------------------------------------------------
    // CONTROLE DE TELAS E FLUXO DO JOGO
    // ---------------------------------------------------------
    function updateStepIndicators(screenId) {
      const d1 = document.getElementById('step-dot-1');
      const d2 = document.getElementById('step-dot-2');
      const d3 = document.getElementById('step-dot-3');
      if (!d1 || !d2 || !d3) return;

      const baseClass = 'h-1.5 w-6 rounded-full transition-colors duration-300';
      d1.className = `${baseClass} bg-borderSubtle`;
      d2.className = `${baseClass} bg-borderSubtle`;
      d3.className = `${baseClass} bg-borderSubtle`;

      if (screenId === 'screen-phase-1') {
        d1.className = `${baseClass} bg-gold`;
      } else if (screenId === 'screen-phase-2') {
        d1.className = `${baseClass} bg-sage`;
        d2.className = `${baseClass} bg-gold`;
      } else if (screenId === 'screen-phase-3') {
        d1.className = `${baseClass} bg-sage`;
        d2.className = `${baseClass} bg-sage`;
        d3.className = `${baseClass} bg-gold`;
      } else if (screenId === 'screen-reveal') {
        d1.className = `${baseClass} bg-sage`;
        d2.className = `${baseClass} bg-sage`;
        d3.className = `${baseClass} bg-sage`;
      }
    }

    function switchScreen(screenId) {
      const screens = [
        'screen-intro',
        'screen-phase-1',
        'screen-phase-2',
        'screen-phase-3',
        'screen-reveal',
      ];

      screens.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === screenId) {
          el.classList.remove('hidden');
          el.classList.remove('animate-screen');
          void el.offsetWidth;
          el.classList.add('animate-screen');
        } else {
          el.classList.add('hidden');
        }
      });

      currentScreen = screenId;
      updateStepIndicators(screenId);
    }

    function cancelAllGameLoops() {
      if (tunerAnimId) {
        cancelAnimationFrame(tunerAnimId);
        tunerAnimId = null;
      }
      if (sparksAnimId) {
        cancelAnimationFrame(sparksAnimId);
        sparksAnimId = null;
      }
      if (holdAnimId) {
        cancelAnimationFrame(holdAnimId);
        holdAnimId = null;
      }
      isHolding = false;
    }

    function startGame() {
      ensureAudioContext();
      playTone(440, 0.12, 'sine', 0.07);
      stopConfetti();
      startPhase1();
    }

    function resetGame() {
      cancelAllGameLoops();
      stopConfetti();
      switchScreen('screen-intro');
    }

    // ---------------------------------------------------------
    // FASE 1 / 3: SINTONIZE O SINAL
    // ---------------------------------------------------------
    function startPhase1() {
      cancelAllGameLoops();
      phase1Locked = false;
      tunerPos = 6;
      tunerDir = 1;
      tunerTargetWidth = 28;
      tunerTargetStart = 30 + Math.floor(Math.random() * 14);

      const targetEl = document.getElementById('tuner-target');
      const cursorEl = document.getElementById('tuner-cursor');
      const feedbackEl = document.getElementById('tuner-feedback');
      const tuneBtn = document.getElementById('btn-tune');

      if (targetEl) {
        targetEl.style.left = `${tunerTargetStart}%`;
        targetEl.style.width = `${tunerTargetWidth}%`;
        targetEl.className =
          'absolute top-0 bottom-0 bg-gold/20 border-x-2 border-gold transition-colors duration-200';
      }
      if (cursorEl) {
        cursorEl.style.left = `${tunerPos}%`;
      }
      if (feedbackEl) {
        feedbackEl.textContent = 'Aguardando frequência...';
        feedbackEl.className = 'text-center text-xs font-medium h-4 text-muted transition-colors';
      }
      if (tuneBtn) {
        tuneBtn.disabled = false;
      }

      switchScreen('screen-phase-1');

      let lastTime = performance.now();
      const speedPerSec = 74;

      function animateTuner(now) {
        if (currentScreen !== 'screen-phase-1' || phase1Locked) return;
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        tunerPos += tunerDir * speedPerSec * dt;
        if (tunerPos >= 95) {
          tunerPos = 95;
          tunerDir = -1;
        } else if (tunerPos <= 5) {
          tunerPos = 5;
          tunerDir = 1;
        }

        if (cursorEl) {
          cursorEl.style.left = `${tunerPos}%`;
        }

        tunerAnimId = requestAnimationFrame(animateTuner);
      }

      tunerAnimId = requestAnimationFrame(animateTuner);
    }

    function attemptTune() {
      if (phase1Locked || currentScreen !== 'screen-phase-1') return;
      ensureAudioContext();

      const targetEnd = tunerTargetStart + tunerTargetWidth;
      const isHit = tunerPos >= tunerTargetStart && tunerPos <= targetEnd;
      const feedbackEl = document.getElementById('tuner-feedback');
      const targetEl = document.getElementById('tuner-target');
      const wrapperEl = document.getElementById('tuner-wrapper');
      const tuneBtn = document.getElementById('btn-tune');

      if (isHit) {
        phase1Locked = true;
        if (tunerAnimId) {
          cancelAnimationFrame(tunerAnimId);
          tunerAnimId = null;
        }
        if (tuneBtn) tuneBtn.disabled = true;
        if (targetEl) {
          targetEl.className =
            'absolute top-0 bottom-0 bg-sage/30 border-x-2 border-sage transition-colors duration-200';
        }
        if (feedbackEl) {
          feedbackEl.textContent = 'Sinal sintonizado! ✨';
          feedbackEl.className = 'text-center text-xs font-medium h-4 text-sage transition-colors';
        }

        playPhaseSuccessSound();
        setTimeout(() => {
          startPhase2();
        }, 600);
      } else {
        playTone(195, 0.14, 'triangle', 0.08);
        if (feedbackEl) {
          feedbackEl.textContent = 'Quase! Tente parar dentro da faixa dourada.';
          feedbackEl.className = 'text-center text-xs font-medium h-4 text-coral transition-colors';
        }
        if (wrapperEl) {
          wrapperEl.classList.remove('animate-shake');
          void wrapperEl.offsetWidth;
          wrapperEl.classList.add('animate-shake');
        }
      }
    }

    // ---------------------------------------------------------
    // FASE 2 / 3: CAPTURE AS FAÍSCAS
    // ---------------------------------------------------------
    function startPhase2() {
      cancelAllGameLoops();
      sparksCollected = 0;
      sparksList = [];
      document.getElementById('sparks-count').textContent = '0';

      switchScreen('screen-phase-2');

      const arena = document.getElementById('sparks-arena');
      arena.innerHTML = '';

      const arenaW = arena.clientWidth || 320;
      const arenaH = arena.clientHeight || 240;
      const pad = 28;

      for (let i = 0; i < TOTAL_SPARKS; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', `Capturar faísca ${i + 1}`);
        btn.className =
          'game-interactive spark-glow absolute w-11 h-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/15 border border-gold/50 text-gold text-lg flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-transform cursor-pointer';
        btn.textContent = '✦';

        const x = pad + Math.random() * Math.max(40, arenaW - pad * 2);
        const y = pad + Math.random() * Math.max(40, arenaH - pad * 2);
        const angle = Math.random() * Math.PI * 2;
        const speed = 38 + Math.random() * 26;

        const sparkObj = {
          id: i,
          el: btn,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          collected: false,
        };

        btn.style.left = `${x}px`;
        btn.style.top = `${y}px`;

        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          collectSpark(sparkObj);
        });

        arena.appendChild(btn);
        sparksList.push(sparkObj);
      }

      let lastTime = performance.now();
      function animateSparks(now) {
        if (currentScreen !== 'screen-phase-2') return;
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        const w = arena.clientWidth || 320;
        const h = arena.clientHeight || 240;

        sparksList.forEach((s) => {
          if (s.collected) return;
          s.x += s.vx * dt;
          s.y += s.vy * dt;

          if (s.x <= pad) {
            s.x = pad;
            s.vx = Math.abs(s.vx);
          } else if (s.x >= w - pad) {
            s.x = w - pad;
            s.vx = -Math.abs(s.vx);
          }

          if (s.y <= pad) {
            s.y = pad;
            s.vy = Math.abs(s.vy);
          } else if (s.y >= h - pad) {
            s.y = h - pad;
            s.vy = -Math.abs(s.vy);
          }

          s.el.style.left = `${s.x}px`;
          s.el.style.top = `${s.y}px`;
        });

        sparksAnimId = requestAnimationFrame(animateSparks);
      }

      sparksAnimId = requestAnimationFrame(animateSparks);
    }

    function collectSpark(sparkObj) {
      if (sparkObj.collected) return;
      sparkObj.collected = true;
      playSparkSound(sparksCollected);

      sparkObj.el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      sparkObj.el.style.transform = 'translate(-50%, -50%) scale(1.6)';
      sparkObj.el.style.opacity = '0';
      sparkObj.el.style.pointerEvents = 'none';

      sparksCollected++;
      document.getElementById('sparks-count').textContent = String(sparksCollected);

      if (sparksCollected >= TOTAL_SPARKS) {
        playPhaseSuccessSound();
        setTimeout(() => {
          startPhase3();
        }, 550);
      }
    }

    // ---------------------------------------------------------
    // FASE 3 / 3: DECODIFIQUE A MENSAGEM
    // ---------------------------------------------------------
    function generateScrambledString(target, progress) {
      const cleanTarget = String(target || 'Giovanna');
      const totalChars = cleanTarget.length;
      const lockedCount = Math.floor(progress * totalChars);

      let result = '';
      for (let i = 0; i < totalChars; i++) {
        const ch = cleanTarget[i];
        if (ch === ' ') {
          result += ' ';
        } else if (i < lockedCount) {
          result += ch;
        } else {
          const randIdx = Math.floor(Math.random() * SCRAMBLE_CHARS.length);
          result += SCRAMBLE_CHARS[randIdx];
        }
      }
      return result;
    }

    function updateHoldRingVisual(progress) {
      const circle = document.getElementById('hold-progress-circle');
      if (!circle) return;
      circle.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
      const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));
      circle.style.strokeDashoffset = `${offset}`;
    }

    function startPhase3() {
      cancelAllGameLoops();
      isHolding = false;
      holdProgress = 0;
      phase3Completed = false;

      updateHoldRingVisual(0);
      document.getElementById('decode-name-display').textContent = generateScrambledString(config.nome, 0);
      document.getElementById('hold-status-text').textContent = 'Pressione e segure por 1,8s';

      switchScreen('screen-phase-3');

      let lastTime = performance.now();
      let lastTickTone = 0;

      function animateHold(now) {
        if (currentScreen !== 'screen-phase-3' || phase3Completed) return;
        const dt = Math.min(now - lastTime, 50);
        lastTime = now;

        if (isHolding) {
          holdProgress = Math.min(1, holdProgress + dt / HOLD_DURATION_MS);
          document.getElementById('hold-status-text').textContent = 'Decodificando...';

          if (now - lastTickTone > 140) {
            lastTickTone = now;
            playTone(340 + holdProgress * 440, 0.08, 'sine', 0.045);
          }
        } else if (holdProgress > 0) {
          holdProgress = Math.max(0, holdProgress - dt / (HOLD_DURATION_MS * 0.75));
          document.getElementById('hold-status-text').textContent = 'Continue segurando até completar...';
        }

        updateHoldRingVisual(holdProgress);
        document.getElementById('decode-name-display').textContent = generateScrambledString(
          config.nome,
          holdProgress
        );

        if (holdProgress >= 1) {
          phase3Completed = true;
          isHolding = false;
          document.getElementById('decode-name-display').textContent = config.nome;
          document.getElementById('hold-status-text').textContent = 'Desbloqueado! ✨';
          playRevealFanfare();

          setTimeout(() => {
            showRevealScreen();
          }, 550);
          return;
        }

        holdAnimId = requestAnimationFrame(animateHold);
      }

      holdAnimId = requestAnimationFrame(animateHold);
    }

    function setupHoldEvents() {
      const holdBtn = document.getElementById('btn-hold-decode');
      if (!holdBtn) return;

      const beginHold = (e) => {
        if (phase3Completed) return;
        if (e) e.preventDefault();
        ensureAudioContext();
        isHolding = true;
      };

      const endHold = () => {
        isHolding = false;
      };

      holdBtn.addEventListener('pointerdown', beginHold);
      holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('pointerup', endHold);
      window.addEventListener('pointercancel', endHold);
    }

    // ---------------------------------------------------------
    // TELA FINAL: REVELAÇÃO, CONFETES E RESPOSTA POR E-MAIL
    // ---------------------------------------------------------
    function showRevealScreen() {
      applyConfigToUI();
      switchScreen('screen-reveal');
      launchConfetti();
    }

    function getComposedEmailDetails() {
      const userTyped = document.getElementById('reply-textarea').value.trim();
      const bodyText =
        userTyped ||
        `Oi! Acabei de jogar o minigame que você fez 😄`;
      const targetEmail = (config.email || '').trim();
      const subjectText = (config.assunto || DEFAULT_CONFIG.assunto).trim();

      return { targetEmail, subjectText, bodyText, userTyped };
    }

    function handleSendEmail() {
      const { targetEmail, subjectText, bodyText } = getComposedEmailDetails();

      const mailtoUri =
        `mailto:${encodeURIComponent(targetEmail)}` +
        `?subject=${encodeURIComponent(subjectText)}` +
        `&body=${encodeURIComponent(bodyText)}`;

      if (!targetEmail) {
        showToast('✉️', 'Abrindo e-mail (configure seu endereço em Personalizar)');
      } else {
        showToast('✉️', `Abrindo seu app de e-mail para ${targetEmail}...`);
      }

      window.location.href = mailtoUri;
    }

    function handleCopyEmailAndMessage() {
      const { targetEmail, subjectText, bodyText } = getComposedEmailDetails();

      const formattedParts = [];
      if (targetEmail) formattedParts.push(`Para: ${targetEmail}`);
      formattedParts.push(`Assunto: ${subjectText}`);
      formattedParts.push(`Mensagem: ${bodyText}`);

      const fullClipboardText = formattedParts.join('\n');

      if (copyToClipboard(fullClipboardText)) {
        showToast('✨', 'Copiado!');
      } else {
        showToast('⚠️', 'Não foi possível copiar automaticamente.');
      }
    }

    // ---------------------------------------------------------
    // CONFETES SUTIS E ELEGANTES EM CANVAS
    // ---------------------------------------------------------
    function launchConfetti() {
      const canvas = document.getElementById('confetti-canvas');
      const ctx = canvas.getContext('2d');
      canvas.classList.remove('hidden');

      function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      const palette = ['#E5B96F', '#D97B66', '#F4F1EA', '#7FA88A'];
      confettiParticles = [];

      for (let i = 0; i < 85; i++) {
        confettiParticles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * -canvas.height - 20,
          w: 6 + Math.random() * 6,
          h: 4 + Math.random() * 8,
          color: palette[i % palette.length],
          vy: 1.4 + Math.random() * 2.2,
          vx: -0.9 + Math.random() * 1.8,
          rotation: Math.random() * 360,
          vRot: -3 + Math.random() * 6,
          opacity: 0.85 + Math.random() * 0.15,
        });
      }

      let elapsed = 0;
      let lastTime = performance.now();

      function renderConfetti(now) {
        const dt = now - lastTime;
        lastTime = now;
        elapsed += dt;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let activeCount = 0;
        confettiParticles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.vRot;

          // Fade suave após 4.5 segundos
          if (elapsed > 4500) {
            p.opacity = Math.max(0, p.opacity - 0.008);
          }

          if (p.y < canvas.height + 30 && p.opacity > 0.01) {
            activeCount++;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 2);
            ctx.fill();
            ctx.restore();
          }
        });

        if (activeCount > 0) {
          confettiAnimId = requestAnimationFrame(renderConfetti);
        } else {
          stopConfetti();
        }
      }

      if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
      confettiAnimId = requestAnimationFrame(renderConfetti);
    }

    function stopConfetti() {
      if (confettiAnimId) {
        cancelAnimationFrame(confettiAnimId);
        confettiAnimId = null;
      }
      const canvas = document.getElementById('confetti-canvas');
      canvas.classList.add('hidden');
    }

    // ---------------------------------------------------------
    // PAINEL DE PERSONALIZAÇÃO, FOTO, LINK E EXPORTAÇÃO HTML
    // ---------------------------------------------------------
    function openPersonalizeModal() {
      document.getElementById('input-nome').value = config.nome;
      document.getElementById('input-msg').value = config.msg;
      document.getElementById('input-email').value = config.email;
      document.getElementById('input-assunto').value = config.assunto;

      draftPhotoData = config.foto || '';
      const isDataUrl = draftPhotoData.startsWith('data:image/');
      document.getElementById('input-foto-url').value = isDataUrl ? '' : draftPhotoData;
      document.getElementById('input-foto-file').value = '';
      updateModalPhotoPreview(draftPhotoData);

      document.getElementById('personalize-modal').classList.remove('hidden');
    }

    function closePersonalizeModal() {
      document.getElementById('personalize-modal').classList.add('hidden');
    }

    function updateModalPhotoPreview(src) {
      const previewImg = document.getElementById('modal-photo-preview');
      const emptyIcon = document.getElementById('modal-photo-empty');
      const removeBtn = document.getElementById('btn-remove-photo');

      if (src && src.trim() !== '') {
        previewImg.src = src.trim();
        previewImg.classList.remove('hidden');
        emptyIcon.classList.add('hidden');
        removeBtn.classList.remove('hidden');
      } else {
        previewImg.removeAttribute('src');
        previewImg.classList.add('hidden');
        emptyIcon.classList.remove('hidden');
        removeBtn.classList.add('hidden');
      }
    }

    function handleModalPreviewError() {
      const previewImg = document.getElementById('modal-photo-preview');
      const emptyIcon = document.getElementById('modal-photo-empty');
      previewImg.classList.add('hidden');
      emptyIcon.classList.remove('hidden');
    }

    function handlePhotoUrlInput(urlVal) {
      draftPhotoData = urlVal.trim();
      updateModalPhotoPreview(draftPhotoData);
    }

    function removeConfiguredPhoto() {
      draftPhotoData = '';
      document.getElementById('input-foto-url').value = '';
      document.getElementById('input-foto-file').value = '';
      updateModalPhotoPreview('');
    }

    function handlePhotoFileUpload(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (loadEvent) {
        const img = new Image();
        img.onload = function () {
          // Redimensiona proporcionalmente via <canvas> para no máximo 480x480px em JPEG
          const MAX_SIZE = 480;
          let targetW = img.width;
          let targetH = img.height;

          if (targetW > MAX_SIZE || targetH > MAX_SIZE) {
            if (targetW > targetH) {
              targetH = Math.round((targetH * MAX_SIZE) / targetW);
              targetW = MAX_SIZE;
            } else {
              targetW = Math.round((targetW * MAX_SIZE) / targetH);
              targetH = MAX_SIZE;
            }
          }

          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = targetW;
          offscreenCanvas.height = targetH;

          const ctx = offscreenCanvas.getContext('2d');
          ctx.drawImage(img, 0, 0, targetW, targetH);

          draftPhotoData = offscreenCanvas.toDataURL('image/jpeg', 0.82);
          document.getElementById('input-foto-url').value = '';
          updateModalPhotoPreview(draftPhotoData);
          showToast('📷', 'Foto carregada e otimizada!');
        };
        img.src = loadEvent.target.result;
      };
      reader.readAsDataURL(file);
    }

    function readModalInputs() {
      const nomeVal = document.getElementById('input-nome').value.trim();
      const msgVal = document.getElementById('input-msg').value.trim();
      const emailVal = document.getElementById('input-email').value.trim();
      const assuntoVal = document.getElementById('input-assunto').value.trim();
      const urlFieldVal = document.getElementById('input-foto-url').value.trim();

      const finalPhoto = draftPhotoData.startsWith('data:image/')
        ? draftPhotoData
        : urlFieldVal;

      return {
        nome: nomeVal || DEFAULT_CONFIG.nome,
        msg: msgVal || DEFAULT_CONFIG.msg,
        foto: finalPhoto,
        email: emailVal,
        assunto: assuntoVal || DEFAULT_CONFIG.assunto,
      };
    }

    function persistConfig() {
      config = readModalInputs();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (e) {}
      applyConfigToUI();
    }

    function saveAndTestConfig() {
      persistConfig();
      closePersonalizeModal();
      resetGame();
      showToast('✅', 'Alterações salvas! Clique em Começar para jogar.');
    }

    function saveAndPreviewReveal() {
      persistConfig();
      closePersonalizeModal();
      cancelAllGameLoops();
      showRevealScreen();
      showToast('✨', 'Pré-visualizando a tela final!');
    }

    function copyPersonalizedLink() {
      persistConfig();

      const baseUrl = window.location.origin + window.location.pathname;
      const params = new URLSearchParams();
      params.set('nome', config.nome);
      params.set('msg', config.msg);
      if (config.email) params.set('email', config.email);
      if (config.assunto) params.set('assunto', config.assunto);

      const isLocalUpload = config.foto && config.foto.startsWith('data:image/');
      if (config.foto && !isLocalUpload) {
        params.set('foto', config.foto);
      }

      const fullUrl = `${baseUrl}?${params.toString()}`;

      try {
        window.history.replaceState(null, '', `?${params.toString()}`);
      } catch (e) {}

      if (copyToClipboard(fullUrl)) {
        if (isLocalUpload) {
          showToast('🔗', 'Link copiado! Para incluir foto local, baixe o .html.');
        } else {
          showToast('🔗', 'Link personalizado copiado!');
        }
      } else {
        showToast('⚠️', 'Não foi possível copiar o link automaticamente.');
      }
    }

    function downloadStandaloneHTML() {
      persistConfig();

      // Garante que o modal esteja oculto e o jogo na tela inicial no HTML exportado
      const modalEl = document.getElementById('personalize-modal');
      const wasModalOpen = !modalEl.classList.contains('hidden');
      modalEl.classList.add('hidden');
      stopConfetti();
      switchScreen('screen-intro');

      // Serializa o documento completo e injeta o novo DEFAULT_CONFIG diretamente no script
      let fullHtml = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      const serializedConfig = JSON.stringify(config, null, 2);
      fullHtml = fullHtml.replace(
        /\/\*__CONFIG_START__\*\/[\s\S]*?\/\*__CONFIG_END__\*\//,
        `/*__CONFIG_START__*/${serializedConfig}/*__CONFIG_END__*/`
      );

      if (wasModalOpen) {
        modalEl.classList.remove('hidden');
      }

      const slugName = (config.nome || 'voce')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'voce';

      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mensagem-para-${slugName}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('⬇️', `Arquivo "mensagem-para-${slugName}.html" baixado!`);
    }

    // ---------------------------------------------------------
    // UTILITÁRIOS (CLIPBOARD E TOAST)
    // ---------------------------------------------------------
    function copyToClipboard(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (err) {
        copied = false;
      }
      document.body.removeChild(textarea);
      return copied;
    }

    function showToast(icon, text) {
      const toast = document.getElementById('toast');
      document.getElementById('toast-icon').textContent = icon;
      document.getElementById('toast-text').textContent = text;

      toast.classList.remove('opacity-0', '-translate-y-2');
      toast.classList.add('opacity-100', 'translate-y-0');

      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2');
        toast.classList.remove('opacity-100', 'translate-y-0');
      }, 3200);
    }

    // ---------------------------------------------------------
    // INICIALIZAÇÃO DA PÁGINA
    // ---------------------------------------------------------
    function initApp() {
      loadConfig();
      applyConfigToUI();
      setupHoldEvents();
      updateStepIndicators('screen-intro');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }