<template>
  <svg viewBox="0 0 64 64" fill="none" class="bird-svg">
    <!-- Bird 0: Canary - 金丝雀 -->
    <template v-if="idx === 0">
      <circle cx="32" cy="37" r="22" fill="#fcea51" />
      <ellipse cx="25" cy="16" rx="3.5" ry="7.5" fill="#ffe033" transform="rotate(-22 25 16)" />
      <ellipse cx="32" cy="13" rx="3" ry="8" fill="#fcea51" />
      <ellipse cx="39" cy="16" rx="3" ry="7" fill="#ffe033" transform="rotate(20 39 16)" />
      <circle cx="23" cy="32" r="5.5" fill="white" />
      <circle cx="41" cy="32" r="5.5" fill="white" />
      <circle cx="23.4" cy="32" r="3.5" fill="#181818" />
      <circle cx="41.4" cy="32" r="3.5" fill="#181818" />
      <circle cx="24.4" cy="31" r="1.15" fill="white" />
      <circle cx="42.4" cy="31" r="1.15" fill="white" />
      <path d="M 27 41 L 32 49 L 37 41 Z" fill="#ff8800" />
      <path d="M 27 41 L 37 41" stroke="#cc6600" stroke-width="0.9" />
      <ellipse cx="18" cy="38" rx="4.5" ry="2.5" fill="#ffbbaa" opacity="0.45" />
      <ellipse cx="46" cy="38" rx="4.5" ry="2.5" fill="#ffbbaa" opacity="0.45" />
    </template>

    <!-- Bird 1: Blue Jay - 蓝松鸦 -->
    <template v-else-if="idx === 1">
      <circle cx="32" cy="36" r="22" fill="#4a90d8" />
      <ellipse cx="32" cy="42" rx="15" ry="13" fill="#d8ecff" />
      <path d="M 25 19 Q 32 9 39 19 Q 35 15 32 17 Q 29 15 25 19 Z" fill="#2a68b0" />
      <path d="M 16 33 Q 32 27 48 33" stroke="#1a2a5a" stroke-width="3" fill="none" stroke-linecap="round" />
      <circle cx="24" cy="30" r="5" fill="white" />
      <circle cx="40" cy="30" r="5" fill="white" />
      <circle cx="24.4" cy="30" r="3" fill="#181818" />
      <circle cx="40.4" cy="30" r="3" fill="#181818" />
      <circle cx="25.4" cy="29" r="1" fill="white" />
      <circle cx="41.4" cy="29" r="1" fill="white" />
      <path d="M 29 38 L 32 45 L 35 38 Z" fill="#7080a0" />
      <path d="M 29 38 L 35 38" stroke="#506070" stroke-width="0.8" />
    </template>

    <!-- Bird 2: Robin - 知更鸟 -->
    <template v-else-if="idx === 2">
      <circle cx="32" cy="36" r="22" fill="#7a4c28" />
      <ellipse cx="32" cy="44" rx="17" ry="14" fill="#e04818" />
      <circle cx="32" cy="28" r="14" fill="#7a4c28" />
      <ellipse cx="32" cy="40" rx="13" ry="10" fill="#e04818" />
      <circle cx="24" cy="27" r="5" fill="white" />
      <circle cx="40" cy="27" r="5" fill="white" />
      <circle cx="24.4" cy="27" r="3" fill="#181818" />
      <circle cx="40.4" cy="27" r="3" fill="#181818" />
      <circle cx="25.4" cy="26" r="1" fill="white" />
      <circle cx="41.4" cy="26" r="1" fill="white" />
      <path d="M 29 34 L 32 39 L 35 34 Z" fill="#281008" />
      <path d="M 29 34 L 35 34" stroke="#180800" stroke-width="0.7" />
      <ellipse cx="18" cy="34" rx="4.5" ry="2.5" fill="#ffbbaa" opacity="0.45" />
      <ellipse cx="46" cy="34" rx="4.5" ry="2.5" fill="#ffbbaa" opacity="0.45" />
    </template>

    <!-- Bird 3: Parakeet - 鹦鹉 -->
    <template v-else-if="idx === 3">
      <circle cx="32" cy="36" r="22" fill="#52b838" />
      <path d="M 14 20 Q 32 15 50 20" stroke="#328820" stroke-width="1.4" fill="none" />
      <path d="M 21 21.5 Q 32 16.5 43 21.5" stroke="#328820" stroke-width="1.4" fill="none" />
      <path d="M 28 23 Q 32 18 36 23" stroke="#328820" stroke-width="1.4" fill="none" />
      <path d="M 35 24.5 Q 32 19.5 29 24.5" stroke="#328820" stroke-width="1.4" fill="none" />
      <ellipse cx="21" cy="38" rx="5.5" ry="4" fill="#88ddff" opacity="0.55" />
      <ellipse cx="43" cy="38" rx="5.5" ry="4" fill="#88ddff" opacity="0.55" />
      <circle cx="24" cy="29" r="5" fill="white" />
      <circle cx="40" cy="29" r="5" fill="white" />
      <circle cx="24.4" cy="29" r="3" fill="#181818" />
      <circle cx="40.4" cy="29" r="3" fill="#181818" />
      <circle cx="25.4" cy="28" r="1" fill="white" />
      <circle cx="41.4" cy="28" r="1" fill="white" />
      <path d="M 27 37 Q 32 38.5 37 37 Q 35 47 32 46 Q 29 47 27 37 Z" fill="#ff9920" />
      <path d="M 27 37 Q 32 38.5 37 37" stroke="#cc7700" stroke-width="0.9" />
    </template>

    <!-- Bird 4: Owl - 猫头鹰 -->
    <template v-else-if="idx === 4">
      <circle cx="32" cy="36" r="22" fill="#b89050" />
      <ellipse cx="32" cy="36" rx="17" ry="18" fill="#e0c078" />
      <path d="M 17 19 L 22 10 L 27 19 Z" fill="#907030" />
      <path d="M 37 19 L 42 10 L 47 19 Z" fill="#907030" />
      <circle cx="22" cy="31" r="8.5" fill="white" stroke="#b89050" stroke-width="2" />
      <circle cx="42" cy="31" r="8.5" fill="white" stroke="#b89050" stroke-width="2" />
      <circle cx="22" cy="31" r="5.5" fill="#c89800" />
      <circle cx="42" cy="31" r="5.5" fill="#c89800" />
      <circle cx="22" cy="31" r="3" fill="#1a1a1a" />
      <circle cx="42" cy="31" r="3" fill="#1a1a1a" />
      <circle cx="23" cy="30" r="1.2" fill="white" />
      <circle cx="43" cy="30" r="1.2" fill="white" />
      <path d="M 29 42 L 32 47 L 35 42 Z" fill="#805820" />
      <path d="M 29 42 L 35 42" stroke="#604010" stroke-width="0.7" />
    </template>

    <!-- Bird 5: Flamingo - 火烈鸟 -->
    <template v-else-if="idx === 5">
      <ellipse cx="32" cy="52" rx="10" ry="13" fill="#f090b8" />
      <ellipse cx="32" cy="29" rx="16" ry="18" fill="#f090b8" />
      <ellipse cx="32" cy="22" rx="12" ry="12" fill="#d86898" />
      <circle cx="24" cy="26" r="4.5" fill="white" />
      <circle cx="40" cy="26" r="4.5" fill="white" />
      <circle cx="24.4" cy="26" r="2.8" fill="#181818" />
      <circle cx="40.4" cy="26" r="2.8" fill="#181818" />
      <circle cx="25.4" cy="25" r="0.9" fill="white" />
      <circle cx="41.4" cy="25" r="0.9" fill="white" />
      <path d="M 36 34 Q 47 33 49 38 Q 50 43 44 43 Q 39 43 36 38 Z" fill="#c85080" />
      <path d="M 36 34 Q 47 33 49 38" stroke="#a03060" stroke-width="1.3" fill="none" />
      <ellipse cx="44" cy="37" rx="2.5" ry="1.3" fill="#902848" opacity="0.45" />
      <ellipse cx="19" cy="33" rx="4.5" ry="2.5" fill="#ffbbaa" opacity="0.45" />
      <ellipse cx="43" cy="33" rx="4.5" ry="2.5" fill="#ffbbaa" opacity="0.45" />
    </template>

    <!-- Bird 6: Kingfisher - 翠鸟 -->
    <template v-else-if="idx === 6">
      <circle cx="32" cy="34" r="22" fill="#28b0c0" />
      <ellipse cx="32" cy="25" rx="16" ry="12" fill="#1888a0" />
      <ellipse cx="32" cy="46" rx="12" ry="11" fill="#e88828" />
      <ellipse cx="32" cy="43" rx="9" ry="9" fill="#f8f0e0" />
      <circle cx="24" cy="27" r="5" fill="white" />
      <circle cx="40" cy="27" r="5" fill="white" />
      <circle cx="24.4" cy="27" r="3" fill="#181818" />
      <circle cx="40.4" cy="27" r="3" fill="#181818" />
      <circle cx="25.4" cy="26" r="1" fill="white" />
      <circle cx="41.4" cy="26" r="1" fill="white" />
      <path d="M 32 38 L 57 35.5 L 57 40.5 L 32 42 Z" fill="#e06010" />
      <line x1="32" y1="38" x2="57" y2="35.5" stroke="#aa4000" stroke-width="0.6" />
    </template>

    <!-- Bird 7: Cardinal - 红衣主教鸟 -->
    <template v-else-if="idx === 7">
      <circle cx="32" cy="36" r="22" fill="#d82828" />
      <path d="M 23 21 Q 32 9 41 21 Q 37 17 32 19 Q 27 17 23 21 Z" fill="#b01010" />
      <ellipse cx="32" cy="32" rx="15" ry="8" fill="#181818" />
      <ellipse cx="32" cy="27" rx="12" ry="5.5" fill="#181818" />
      <circle cx="23" cy="27" r="5.5" fill="white" />
      <circle cx="41" cy="27" r="5.5" fill="white" />
      <circle cx="23.4" cy="27" r="3.5" fill="#181818" />
      <circle cx="41.4" cy="27" r="3.5" fill="#181818" />
      <circle cx="24.4" cy="26" r="1.15" fill="white" />
      <circle cx="42.4" cy="26" r="1.15" fill="white" />
      <path d="M 27 38 L 32 45 L 37 38 Z" fill="#ff7722" />
      <path d="M 27 38 L 37 38" stroke="#dd5500" stroke-width="0.9" />
      <ellipse cx="32" cy="49" rx="8" ry="5" fill="#e84040" opacity="0.45" />
    </template>

    <!-- Bird 8: Dove - 鸽子 -->
    <template v-else-if="idx === 8">
      <circle cx="32" cy="36" r="22" fill="#f0ece4" />
      <ellipse cx="32" cy="46" rx="18" ry="10" fill="#e4dcd0" />
      <circle cx="32" cy="27" r="14" fill="#f8f4ee" />
      <ellipse cx="32" cy="38" rx="10" ry="6" fill="#d0e8ff" opacity="0.35" />
      <circle cx="25" cy="25" r="4.5" fill="white" />
      <circle cx="39" cy="25" r="4.5" fill="white" />
      <circle cx="25.4" cy="25" r="2.8" fill="#181818" />
      <circle cx="39.4" cy="25" r="2.8" fill="#181818" />
      <circle cx="26.4" cy="24" r="0.9" fill="white" />
      <circle cx="40.4" cy="24" r="0.9" fill="white" />
      <path d="M 29 32 L 32 38 L 35 32 Z" fill="#e08090" />
      <path d="M 29 32 L 35 32" stroke="#c06070" stroke-width="0.7" />
      <ellipse cx="21" cy="32" rx="4.5" ry="2.5" fill="#ffbbaa" opacity="0.45" />
      <ellipse cx="43" cy="32" rx="4.5" ry="2.5" fill="#ffbbaa" opacity="0.45" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  idx: {
    type: Number,
    required: true,
    validator: (value) => value >= 0 && value <= 8
  }
});
</script>

<style scoped>
.bird-svg {
  width: 70%;
  height: 70%;
  animation: birdFloat 3s ease-in-out infinite;
}

@keyframes birdFloat {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-4rpx) scale(1.02);
  }
}
</style>