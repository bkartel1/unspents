import should from 'should';

// @ts-ignore
import * as HDKey from 'hdkey';

import { Dimensions } from '../../src';

import {
  getInputDimensionsForUnspentType,
  getOutputDimensionsForUnspentType,
  UnspentTypePubKeyHash,
  UnspentTypeScript2of3,
} from '../testutils';

import {
  runCombinations,
  TxCombo,
} from './txGen';

const testDimensionsFromTx = (txCombo: any) => {
  const { inputTypes, outputTypes, expectedDims } = txCombo;

  describe(`Combination inputs=${inputTypes}; outputs=${outputTypes}`, function() {
    const nInputs = inputTypes.length;
    const outputDims = Dimensions.sum(...outputTypes.map(getOutputDimensionsForUnspentType));

    it(`calculates dimensions from unsigned transaction`, function() {
      const unsignedTx = txCombo.getUnsignedTx();

      // does not work for unsigned transactions
      should.throws(() => Dimensions.fromTransaction(unsignedTx));

      // unless explicitly allowed
      Dimensions.fromTransaction(unsignedTx, { assumeUnsigned: Dimensions.ASSUME_P2SH })
        .should.eql(Dimensions.sum({ nP2shInputs: nInputs }, outputDims));

      Dimensions.fromTransaction(unsignedTx, { assumeUnsigned: Dimensions.ASSUME_P2SH_P2WSH })
        .should.eql(Dimensions.sum({ nP2shP2wshInputs: nInputs }, outputDims));

      Dimensions.fromTransaction(unsignedTx, { assumeUnsigned: Dimensions.ASSUME_P2WSH })
        .should.eql(Dimensions.sum({ nP2wshInputs: nInputs }, outputDims));
    });

    it(`calculates dimensions for signed transaction`, function() {
      const dimensions = Dimensions.fromTransaction(txCombo.getSignedTx());
      dimensions.should.eql(expectedDims);
    });

    it(`calculates dimensions for signed input of transaction`, function() {
      const signedTx = txCombo.getSignedTx();

      // test Dimensions.fromInput()
      inputTypes.forEach((input: any, i: number) =>
        Dimensions.fromInput(signedTx.ins[i])
          .should.eql(Dimensions.sum(getInputDimensionsForUnspentType(input))),
      );
    });
  });
};

describe(`Dimensions for transaction combinations`, function() {
  const params = {
    inputTypes: Object.keys(UnspentTypeScript2of3),
    maxNInputs: 3,
    outputTypes: [...Object.keys(UnspentTypeScript2of3), ...Object.keys(UnspentTypePubKeyHash)],
    maxNOutputs: 3,
  };

  runCombinations(params, (inputTypeCombo: any, outputTypeCombo: any) => {
    const expectedInputDims = Dimensions.sum(...inputTypeCombo.map(getInputDimensionsForUnspentType));
    const expectedOutputDims = Dimensions.sum(...outputTypeCombo.map(getOutputDimensionsForUnspentType));

    const keys = [1, 2, 3].map((v) => HDKey.fromMasterSeed(Buffer.from(`test/2/${v}`)));

    testDimensionsFromTx(
      new TxCombo(
        keys,
        inputTypeCombo,
        outputTypeCombo,
        expectedInputDims.plus(expectedOutputDims),
      ),
    );

    // Doubling the inputs should yield twice the input dims
    testDimensionsFromTx(
      new TxCombo(
        keys,
        [...inputTypeCombo, ...inputTypeCombo],
        outputTypeCombo,
        expectedInputDims.plus(expectedInputDims).plus(expectedOutputDims),
      ),
    );

    // Same for outputs
    testDimensionsFromTx(
      new TxCombo(
        keys,
        inputTypeCombo,
        [...outputTypeCombo, ...outputTypeCombo],
        expectedInputDims.plus(expectedOutputDims).plus(expectedOutputDims),
      ),
    );
  });
});
