const QR_LOW_ERROR_CORRECTION = {
	dataCodewords: [0, 19, 34, 55, 80, 108],
	errorCodewords: [0, 7, 10, 15, 20, 26],
	alignment: [null, [], [6, 18], [6, 22], [6, 26], [6, 30]],
};

function multiplyQrField(left, right) {
	let product = 0;

	for (let index = 7; index >= 0; index -= 1) {
		product = (product << 1) ^ ((product >>> 7) * 0x11d);

		if (((right >>> index) & 1) !== 0) {
			product ^= left;
		}
	}

	return product & 0xff;
}

function createQrErrorCorrectionDivisor(degree) {
	const result = Array(degree).fill(0);
	let root = 1;

	result[degree - 1] = 1;

	for (let index = 0; index < degree; index += 1) {
		for (let term = 0; term < degree; term += 1) {
			result[term] = multiplyQrField(result[term], root);

			if (term + 1 < degree) {
				result[term] ^= result[term + 1];
			}
		}

		root = multiplyQrField(root, 2);
	}

	return result;
}

function createQrErrorCorrection(data, degree) {
	const divisor = createQrErrorCorrectionDivisor(degree);
	const result = Array(degree).fill(0);

	data.forEach((byte) => {
		const factor = byte ^ result.shift();

		result.push(0);

		divisor.forEach((coefficient, index) => {
			result[index] ^= multiplyQrField(coefficient, factor);
		});
	});

	return result;
}

function appendQrBits(bits, value, length) {
	for (let index = length - 1; index >= 0; index -= 1) {
		bits.push((value >>> index) & 1);
	}
}

function getQrFormatBits(mask) {
	let data = (1 << 3) | mask;
	let bits = data << 10;

	for (let index = 14; index >= 10; index -= 1) {
		if (((bits >>> index) & 1) !== 0) {
			bits ^= 0x537 << (index - 10);
		}
	}

	return ((data << 10) | bits) ^ 0x5412;
}

function createQrMatrix(size) {
	return Array.from({ length: size }, () => Array(size).fill(null));
}

function setQrModule(matrix, row, column, dark) {
	if (
		row >= 0 &&
		row < matrix.length &&
		column >= 0 &&
		column < matrix.length
	) {
		matrix[row][column] = Boolean(dark);
	}
}

function drawQrFinder(matrix, top, left) {
	for (let row = -1; row <= 7; row += 1) {
		for (let column = -1; column <= 7; column += 1) {
			const absoluteRow = top + row;
			const absoluteColumn = left + column;
			const isFinder =
				row >= 0 &&
				row <= 6 &&
				column >= 0 &&
				column <= 6 &&
				(row === 0 ||
					row === 6 ||
					column === 0 ||
					column === 6 ||
					(row >= 2 && row <= 4 && column >= 2 && column <= 4));

			setQrModule(matrix, absoluteRow, absoluteColumn, isFinder);
		}
	}
}

function drawQrAlignment(matrix, centerRow, centerColumn) {
	for (let row = -2; row <= 2; row += 1) {
		for (let column = -2; column <= 2; column += 1) {
			setQrModule(
				matrix,
				centerRow + row,
				centerColumn + column,
				Math.max(Math.abs(row), Math.abs(column)) !== 1
			);
		}
	}
}

function drawQrFunctionPatterns(matrix, version) {
	const size = matrix.length;

	drawQrFinder(matrix, 0, 0);
	drawQrFinder(matrix, size - 7, 0);
	drawQrFinder(matrix, 0, size - 7);

	for (let index = 8; index < size - 8; index += 1) {
		setQrModule(matrix, 6, index, index % 2 === 0);
		setQrModule(matrix, index, 6, index % 2 === 0);
	}

	QR_LOW_ERROR_CORRECTION.alignment[version].forEach((row) => {
		QR_LOW_ERROR_CORRECTION.alignment[version].forEach((column) => {
			const nearFinder =
				(row === 6 && column === 6) ||
				(row === 6 && column === size - 7) ||
				(row === size - 7 && column === 6);

			if (!nearFinder) {
				drawQrAlignment(matrix, row, column);
			}
		});
	});

	for (let index = 0; index < 8; index += 1) {
		if (index !== 6) {
			setQrModule(matrix, 8, index, false);
			setQrModule(matrix, index, 8, false);
		}

		setQrModule(matrix, 8, size - 1 - index, false);
		setQrModule(matrix, size - 1 - index, 8, false);
	}

	for (let index = 8; index < 15; index += 1) {
		setQrModule(matrix, 8, size - 15 + index, false);
		setQrModule(matrix, size - 1 - index, 8, false);
	}

	setQrModule(matrix, size - 8, 8, true);
}

function drawQrFormatBits(matrix, mask) {
	const size = matrix.length;
	const bits = getQrFormatBits(mask);

	for (let index = 0; index <= 5; index += 1) {
		setQrModule(matrix, 8, index, ((bits >>> index) & 1) !== 0);
	}

	setQrModule(matrix, 8, 7, ((bits >>> 6) & 1) !== 0);
	setQrModule(matrix, 8, 8, ((bits >>> 7) & 1) !== 0);
	setQrModule(matrix, 7, 8, ((bits >>> 8) & 1) !== 0);

	for (let index = 9; index < 15; index += 1) {
		setQrModule(matrix, 14 - index, 8, ((bits >>> index) & 1) !== 0);
	}

	for (let index = 0; index < 8; index += 1) {
		setQrModule(matrix, size - 1 - index, 8, ((bits >>> index) & 1) !== 0);
	}

	for (let index = 8; index < 15; index += 1) {
		setQrModule(matrix, 8, size - 15 + index, ((bits >>> index) & 1) !== 0);
	}
}

function createQrCodewords(text) {
	const bytes = Array.from(new TextEncoder().encode(text));
	const version = [1, 2, 3, 4, 5].find(
		(candidate) => bytes.length <= QR_LOW_ERROR_CORRECTION.dataCodewords[candidate] - 2
	);

	if (!version) {
		throw new Error("QR value is too long.");
	}

	const dataCodewords = QR_LOW_ERROR_CORRECTION.dataCodewords[version];
	const bits = [];

	appendQrBits(bits, 0x4, 4);
	appendQrBits(bits, bytes.length, 8);
	bytes.forEach((byte) => appendQrBits(bits, byte, 8));
	appendQrBits(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));

	while (bits.length % 8 !== 0) {
		bits.push(0);
	}

	const data = [];

	for (let index = 0; index < bits.length; index += 8) {
		let byte = 0;

		for (let offset = 0; offset < 8; offset += 1) {
			byte = (byte << 1) | bits[index + offset];
		}

		data.push(byte);
	}

	for (let pad = 0; data.length < dataCodewords; pad += 1) {
		data.push(pad % 2 === 0 ? 0xec : 0x11);
	}

	return {
		version,
		codewords: data.concat(
			createQrErrorCorrection(
				data,
				QR_LOW_ERROR_CORRECTION.errorCodewords[version]
			)
		),
	};
}

function shouldApplyQrMask(row, column) {
	return (row + column) % 2 === 0;
}

function drawQrData(matrix, codewords) {
	const bits = [];
	let bitIndex = 0;
	let upward = true;

	codewords.forEach((byte) => appendQrBits(bits, byte, 8));

	for (let right = matrix.length - 1; right >= 1; right -= 2) {
		if (right === 6) {
			right -= 1;
		}

		for (let vertical = 0; vertical < matrix.length; vertical += 1) {
			const row = upward ? matrix.length - 1 - vertical : vertical;

			for (let offset = 0; offset < 2; offset += 1) {
				const column = right - offset;

				if (matrix[row][column] !== null) {
					continue;
				}

				const dark = bitIndex < bits.length && bits[bitIndex] === 1;

				matrix[row][column] = dark !== shouldApplyQrMask(row, column);
				bitIndex += 1;
			}
		}

		upward = !upward;
	}
}

function createQrMatrixForText(text) {
	const { version, codewords } = createQrCodewords(text);
	const size = 17 + version * 4;
	const matrix = createQrMatrix(size);

	drawQrFunctionPatterns(matrix, version);
	drawQrData(matrix, codewords);
	drawQrFormatBits(matrix, 0);

	return matrix;
}

function renderQrCode(container, value) {
	const matrix = createQrMatrixForText(value);
	const quietZone = 4;
	const size = matrix.length + quietZone * 2;
	let modules = "";

	matrix.forEach((row, rowIndex) => {
		row.forEach((dark, columnIndex) => {
			if (dark) {
				modules +=
					'<rect x="' +
					(columnIndex + quietZone) +
					'" y="' +
					(rowIndex + quietZone) +
					'" width="1" height="1"/>';
			}
		});
	});

	container.innerHTML =
		'<svg class="live-qr-svg" role="img" aria-label="QR kode til join-link" viewBox="0 0 ' +
		size +
		" " +
		size +
		'" shape-rendering="crispEdges"><rect width="' +
		size +
		'" height="' +
		size +
		'" fill="#fff"/><g fill="#000">' +
		modules +
		"</g></svg>";
}
